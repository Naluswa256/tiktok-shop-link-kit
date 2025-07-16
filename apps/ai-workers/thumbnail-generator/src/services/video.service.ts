import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import axios from 'axios';
import sharp from 'sharp';
import { VideoProcessingResult, FrameAnalysis, WorkerConfig, ThumbnailResult } from '../types';

// Simple logger implementation
class Logger {
  constructor(private context: string) {}

  info(message: string, meta?: Record<string, unknown>) {
    console.log(`[${this.context}] INFO: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(`[${this.context}] ERROR: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[${this.context}] WARN: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[${this.context}] DEBUG: ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
}

export class VideoService {
  private logger = new Logger('VideoService');
  private tempDir: string;

  constructor(private config: WorkerConfig) {
    this.tempDir = path.join(os.tmpdir(), 'thumbnail-generator');

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async processVideo(videoUrl: string, videoId: string): Promise<VideoProcessingResult> {
    const startTime = Date.now();
    let videoPath: string | null = null;
    let framesDir: string | null = null;

    try {
      this.logger.info('Starting video processing for multiple thumbnails', {
        videoId,
        videoUrl,
        thumbnailsToGenerate: this.config.thumbnailsToGenerate
      });

      // Download video (simulated for now)
      videoPath = await this.downloadVideo(videoUrl, videoId);

      // Validate video
      const videoInfo = await this.getVideoInfo(videoPath);
      await this.validateVideo(videoInfo);
      const videoDuration = videoInfo.format?.duration || 30;

      // Extract frames at strategic intervals
      framesDir = await this.extractFrames(videoPath, videoId);

      // Analyze frames (this will call Python YOLO service)
      const frameAnalyses = await this.analyzeFrames(framesDir, videoId);

      if (frameAnalyses.length === 0) {
        throw new Error('No frames could be analyzed');
      }

      // Select multiple best frames for thumbnails
      const selectedFrames = this.selectMultipleBestFrames(frameAnalyses, this.config.thumbnailsToGenerate);

      if (selectedFrames.length === 0) {
        throw new Error('No suitable frames found for thumbnails');
      }

      // Generate thumbnails from selected frames
      const thumbnails: ThumbnailResult[] = [];

      for (let i = 0; i < selectedFrames.length; i++) {
        const frame = selectedFrames[i];
        const framePath = path.join(framesDir, `frame_${frame.frame_index.toString().padStart(6, '0')}.jpg`);

        try {
          const thumbnailPath = await this.generateThumbnail(framePath, videoId, i);

          // For now, simulate S3 upload (will be handled by S3Service)
          const s3Key = `thumbnails/${videoId}/thumbnail_${i}.jpg`;
          const s3Url = `https://s3.amazonaws.com/bucket/${s3Key}`;

          thumbnails.push({
            thumbnail_path: thumbnailPath,
            s3_key: s3Key,
            s3_url: s3Url,
            frame_analysis: frame
          });

        } catch (error) {
          this.logger.warn(`Failed to generate thumbnail ${i} for ${videoId}`, { error: error.message });
        }
      }

      if (thumbnails.length === 0) {
        throw new Error('Failed to generate any thumbnails');
      }

      // Select primary thumbnail (highest quality score)
      const primaryThumbnail = thumbnails.reduce((best, current) =>
        current.frame_analysis.quality_score > best.frame_analysis.quality_score ? current : best
      );

      const processingTime = Date.now() - startTime;

      this.logger.info('Video processing completed', {
        videoId,
        thumbnailsGenerated: thumbnails.length,
        primaryThumbnailIndex: thumbnails.indexOf(primaryThumbnail),
        processingTime: `${processingTime}ms`,
        framesAnalyzed: frameAnalyses.length
      });

      return {
        success: true,
        thumbnails,
        primary_thumbnail: primaryThumbnail,
        processing_time: processingTime,
        frames_analyzed: frameAnalyses.length,
        video_duration: videoDuration
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Video processing failed', {
        videoId,
        error: errorMessage,
        processingTime: `${processingTime}ms`
      });

      return {
        success: false,
        thumbnails: [],
        error: errorMessage,
        processing_time: processingTime,
        frames_analyzed: 0,
        video_duration: 0
      };

    } finally {
      // Cleanup temporary files
      await this.cleanup(videoPath, framesDir);
    }
  }

  private async downloadVideo(videoUrl: string, videoId: string): Promise<string> {
    const outputTemplate = path.join(this.tempDir, `${videoId}.%(ext)s`);

    try {
      this.logger.info('Downloading video with yt-dlp', { videoId, videoUrl });

      // Use yt-dlp to download the video
      const ytDlpArgs = [
        videoUrl,
        '--output', outputTemplate,
        '--format', 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
        '--no-playlist',
        '--max-filesize', `${this.config.maxVideoSizeMB}M`,
        '--socket-timeout', '30',
        '--retries', '3',
        '--no-warnings',
        '--quiet'
      ];

      await this.runCommand('yt-dlp', ytDlpArgs);

      // Find the downloaded file
      const files = fs.readdirSync(this.tempDir).filter(f => f.startsWith(videoId));
      if (files.length === 0) {
        throw new Error('Downloaded video file not found');
      }

      const videoPath = path.join(this.tempDir, files[0]);

      // Verify file exists and has content
      const stats = fs.statSync(videoPath);
      if (stats.size === 0) {
        throw new Error('Downloaded video file is empty');
      }

      this.logger.info('Video downloaded successfully', {
        videoId,
        videoPath,
        fileSize: `${Math.round(stats.size / 1024 / 1024)}MB`
      });

      return videoPath;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Video download failed', { videoId, error: errorMessage });
      throw new Error(`Failed to download video: ${errorMessage}`);
    }
  }

  private async getVideoInfo(videoPath: string): Promise<any> {
    try {
      this.logger.info('Getting video info with ffprobe', { videoPath });

      const ffprobeArgs = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ];

      const output = await this.runCommand('ffprobe', ffprobeArgs);
      const videoInfo = JSON.parse(output);

      this.logger.info('Video info retrieved successfully', {
        duration: videoInfo.format?.duration,
        size: videoInfo.format?.size,
        format: videoInfo.format?.format_name
      });

      return videoInfo;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get video info', { videoPath, error: errorMessage });
      throw new Error(`Failed to analyze video: ${errorMessage}`);
    }
  }

  private async validateVideo(videoInfo: { format?: { duration?: number; size?: number } }): Promise<void> {
    const duration = videoInfo.format?.duration;
    const size = videoInfo.format?.size;

    if (!duration) {
      throw new Error('Could not determine video duration');
    }

    if (duration > this.config.maxVideoDurationSeconds) {
      throw new Error(`Video too long: ${duration}s (max: ${this.config.maxVideoDurationSeconds}s)`);
    }

    if (size && size > this.config.maxVideoSizeMB * 1024 * 1024) {
      throw new Error(`Video too large: ${Math.round(size / 1024 / 1024)}MB (max: ${this.config.maxVideoSizeMB}MB)`);
    }

    this.logger.info('Video validation passed', {
      duration: `${duration}s`,
      size: size ? `${Math.round(size / 1024 / 1024)}MB` : 'unknown'
    });
  }

  private async extractFrames(videoPath: string, videoId: string): Promise<string> {
    const framesDir = path.join(this.tempDir, `frames_${videoId}`);

    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    try {
      this.logger.info('Extracting frames with ffmpeg', { videoId, framesDir });

      // Use ffmpeg to extract frames at specified intervals
      const outputPattern = path.join(framesDir, 'frame_%06d.jpg');
      const ffmpegArgs = [
        '-i', videoPath,
        '-vf', `fps=1/${this.config.frameExtractionInterval}`, // Extract 1 frame every N seconds
        '-q:v', '2', // High quality
        '-y', // Overwrite output files
        outputPattern
      ];

      await this.runCommand('ffmpeg', ffmpegArgs);

      // Count extracted frames
      const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg'));
      const frameCount = frameFiles.length;

      if (frameCount === 0) {
        throw new Error('No frames were extracted from the video');
      }

      // Limit to max frames to analyze
      if (frameCount > this.config.maxFramesToAnalyze) {
        // Remove excess frames (keep evenly distributed frames)
        const framesToKeep = this.config.maxFramesToAnalyze;
        const step = Math.floor(frameCount / framesToKeep);

        frameFiles.forEach((file, index) => {
          if (index % step !== 0 && index >= framesToKeep) {
            fs.unlinkSync(path.join(framesDir, file));
          }
        });
      }

      const finalFrameCount = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).length;
      this.logger.info('Frame extraction completed', { videoId, frameCount: finalFrameCount });

      return framesDir;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Frame extraction failed', { videoId, error: errorMessage });
      throw error;
    }
  }

  private async analyzeFrames(framesDir: string, videoId: string): Promise<FrameAnalysis[]> {
    const frameFiles = fs.readdirSync(framesDir)
      .filter(f => f.endsWith('.jpg'))
      .sort()
      .slice(0, this.config.maxFramesToAnalyze);

    this.logger.info('Analyzing frames with YOLO', { 
      videoId, 
      frameCount: frameFiles.length 
    });

    const analyses: FrameAnalysis[] = [];

    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i];
      const framePath = path.join(framesDir, frameFile);
      
      try {
        const analysis = await this.analyzeFrame(framePath, i);
        analyses.push(analysis);
      } catch (error) {
        this.logger.warn('Frame analysis failed', { 
          videoId, 
          frameFile, 
          error: error.message 
        });
      }
    }

    return analyses;
  }

  private async analyzeFrame(framePath: string, frameIndex: number): Promise<FrameAnalysis> {
    const timestamp = frameIndex * this.config.frameExtractionInterval;

    try {
      // Call Python YOLO service via HTTP
      const analysis = await this.callYoloService(framePath, frameIndex, timestamp);

      return {
        frame_index: frameIndex,
        timestamp,
        quality_score: analysis.quality_score,
        detected_objects: analysis.detected_objects,
        has_product: analysis.has_product,
        blur_score: analysis.blur_score,
        brightness_score: analysis.brightness_score,
        composition_score: analysis.quality_score // Use quality_score as composition_score
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('YOLO analysis failed, using fallback', { error: errorMessage });

      // Fallback to basic analysis
      return this.basicFrameAnalysis(frameIndex, timestamp);
    }
  }

  private async callYoloService(framePath: string, frameIndex: number, timestamp: number): Promise<FrameAnalysis> {
    const yoloServiceUrl = process.env.YOLO_SERVICE_URL || 'http://localhost:8000';

    try {
      const response = await axios.post(`${yoloServiceUrl}/analyze`, {
        frame_path: framePath,
        frame_index: frameIndex,
        timestamp: timestamp
      }, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;

    } catch (error: unknown) {
      const axiosError = error as { code?: string; response?: { status: number; data?: { detail?: string } } };
      if (axiosError.code === 'ECONNREFUSED') {
        throw new Error('YOLO service is not running. Please start the YOLO service first.');
      } else if (axiosError.response) {
        throw new Error(`YOLO service error: ${axiosError.response.status} - ${axiosError.response.data?.detail || 'Unknown error'}`);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`YOLO service call failed: ${errorMessage}`);
      }
    }
  }

  private basicFrameAnalysis(frameIndex: number, timestamp: number): FrameAnalysis {
    // Basic quality metrics (simplified fallback)
    const qualityScore = Math.random() * 0.5 + 0.5; // 0.5-1.0
    const blurScore = Math.random() * 0.3; // 0-0.3 (lower is better)
    const brightnessScore = Math.random() * 0.4 + 0.6; // 0.6-1.0

    // Mock object detection
    const hasProduct = Math.random() > 0.3; // 70% chance of detecting product
    const detected_objects = hasProduct ? [{
      class_name: 'product',
      confidence: 0.8 + Math.random() * 0.2,
      bbox: {
        x: Math.random() * 0.3,
        y: Math.random() * 0.3,
        width: 0.3 + Math.random() * 0.4,
        height: 0.3 + Math.random() * 0.4
      }
    }] : [];

    const compositionScore = hasProduct ? 0.7 + Math.random() * 0.3 : 0.3 + Math.random() * 0.4;

    return {
      frame_index: frameIndex,
      timestamp,
      quality_score: qualityScore,
      detected_objects,
      has_product: hasProduct,
      blur_score: blurScore,
      brightness_score: brightnessScore,
      composition_score: compositionScore
    };
  }

  private selectMultipleBestFrames(frameAnalyses: FrameAnalysis[], count: number): FrameAnalysis[] {
    // Sort frames by combined quality score
    const sortedFrames = frameAnalyses
      .map(frame => ({
        frame,
        score: this.calculateCombinedScore(frame)
      }))
      .sort((a, b) => b.score - a.score);

    // Select top frames, ensuring diversity in timestamps
    const selectedFrames: FrameAnalysis[] = [];
    const minTimestampGap = 3; // Minimum 3 seconds between selected frames

    for (const { frame } of sortedFrames) {
      if (selectedFrames.length >= count) break;

      // Check if this frame is far enough from already selected frames
      const tooClose = selectedFrames.some(selected =>
        Math.abs(selected.timestamp - frame.timestamp) < minTimestampGap
      );

      if (!tooClose || selectedFrames.length === 0) {
        selectedFrames.push(frame);
      }
    }

    // If we don't have enough diverse frames, fill with best remaining frames
    if (selectedFrames.length < count) {
      for (const { frame } of sortedFrames) {
        if (selectedFrames.length >= count) break;
        if (!selectedFrames.includes(frame)) {
          selectedFrames.push(frame);
        }
      }
    }

    this.logger.info('Selected frames for thumbnails', {
      totalFrames: frameAnalyses.length,
      selectedCount: selectedFrames.length,
      timestamps: selectedFrames.map(f => f.timestamp),
      scores: selectedFrames.map(f => this.calculateCombinedScore(f))
    });

    return selectedFrames;
  }

  private selectBestFrame(frameAnalyses: FrameAnalysis[]): FrameAnalysis | null {
    // Filter frames that meet minimum quality requirements
    const validFrames = frameAnalyses.filter(frame =>
      frame.has_product &&
      frame.quality_score >= this.config.minQualityScore &&
      frame.brightness_score >= this.config.minBrightnessScore &&
      frame.blur_score <= this.config.maxBlurScore
    );

    if (validFrames.length === 0) {
      // Fallback: select best frame even if it doesn't meet all criteria
      return frameAnalyses.reduce((best, current) =>
        current.quality_score > best.quality_score ? current : best
      );
    }

    // Select frame with highest combined score
    return validFrames.reduce((best, current) => {
      const currentScore = this.calculateCombinedScore(current);
      const bestScore = this.calculateCombinedScore(best);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateCombinedScore(frame: FrameAnalysis): number {
    return (
      frame.quality_score * 0.3 +
      frame.composition_score * 0.3 +
      frame.brightness_score * 0.2 +
      (1 - frame.blur_score) * 0.2 // Invert blur score (lower is better)
    );
  }

  private async generateThumbnail(framePath: string, videoId: string, index: number): Promise<string> {
    const thumbnailPath = path.join(this.tempDir, `thumbnail_${videoId}_${index}.jpg`);

    try {
      this.logger.info('Generating thumbnail with Sharp', { videoId, index, framePath, thumbnailPath });

      // Use Sharp to resize and optimize the image
      const sharp = require('sharp');

      await sharp(framePath)
        .resize(this.config.thumbnailWidth, this.config.thumbnailHeight, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({
          quality: this.config.thumbnailQuality,
          progressive: true,
          mozjpeg: true // Better compression
        })
        .toFile(thumbnailPath);

      // Verify the thumbnail was created
      const stats = fs.statSync(thumbnailPath);
      if (stats.size === 0) {
        throw new Error('Generated thumbnail file is empty');
      }

      this.logger.info('Thumbnail generated successfully', {
        videoId,
        index,
        thumbnailPath,
        fileSize: `${Math.round(stats.size / 1024)}KB`
      });

      return thumbnailPath;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Thumbnail generation failed', { videoId, index, error: errorMessage });
      throw error;
    }
  }

  private async runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Running command: ${command} ${args.join(' ')}`);

      const process = spawn(command, args);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      process.on('close', (code: number) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          const error = new Error(`Command failed with code ${code}: ${stderr || 'Unknown error'}`);
          reject(error);
        }
      });

      process.on('error', (error: Error) => {
        reject(new Error(`Failed to start command ${command}: ${error.message}`));
      });
    });
  }

  private async cleanup(videoPath: string | null, framesDir: string | null): Promise<void> {
    try {
      if (videoPath && fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }

      if (framesDir && fs.existsSync(framesDir)) {
        fs.rmSync(framesDir, { recursive: true, force: true });
      }

      this.logger.debug('Cleanup completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Cleanup failed', { error: errorMessage });
    }
  }
}
