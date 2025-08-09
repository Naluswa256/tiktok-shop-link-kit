#!/usr/bin/env node

/**
 * Local Thumbnail Generator Test Script
 * 
 * This script allows you to test the thumbnail generation pipeline locally
 * without relying on AWS services (SQS, SNS, S3).
 * 
 * Features:
 * - Accepts TikTok video URLs directly
 * - Runs the full pipeline (download → frame extraction → YOLO analysis → thumbnail generation)
 * - Saves thumbnails to local ./generated_thumbnails/ folder
 * - Detailed logging of the entire process
 * - No AWS dependencies
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Test video URLs - you can modify these or add more
const testVideoUrls = [
  "https://www.tiktok.com/@nalu-fashion/video/7234567890123456789",
  "https://www.tiktok.com/@fashionqueen/video/7234567890123456790",
  // Add more TikTok URLs here for testing
];

// Local output directory
const OUTPUT_DIR = './generated_thumbnails';

// Mock S3 Service for local testing
class LocalS3Service {
  constructor(bucketName, region) {
    this.bucketName = bucketName;
    this.region = region;
    this.logger = { 
      info: (msg, meta) => console.log(`[LocalS3] ${msg}`, meta || ''),
      error: (msg, meta) => console.error(`[LocalS3] ${msg}`, meta || ''),
      warn: (msg, meta) => console.warn(`[LocalS3] ${msg}`, meta || '')
    };
    
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }

  async uploadThumbnail(filePath, sellerHandle, videoId, index = 0, isPrimary = false) {
    try {
      const fileName = isPrimary ? `${videoId}_primary.jpg` : `${videoId}_${index}.jpg`;
      const localPath = path.join(OUTPUT_DIR, `${sellerHandle}-${fileName}`);
      
      // Copy file to output directory
      fs.copyFileSync(filePath, localPath);
      
      const stats = fs.statSync(localPath);
      
      this.logger.info('Thumbnail saved locally', {
        originalPath: filePath,
        savedPath: localPath,
        fileSize: `${Math.round(stats.size / 1024)}KB`,
        index,
        isPrimary
      });

      return {
        success: true,
        s3Key: `local/${sellerHandle}/${fileName}`,
        s3Url: `file://${path.resolve(localPath)}`
      };

    } catch (error) {
      this.logger.error('Failed to save thumbnail locally', {
        error: error.message,
        filePath,
        sellerHandle,
        videoId,
        index
      });

      return {
        success: false,
        s3Key: '',
        s3Url: '',
        error: error.message
      };
    }
  }

  async uploadMultipleThumbnails(thumbnailPaths, sellerHandle, videoId) {
    const results = [];

    for (let i = 0; i < thumbnailPaths.length; i++) {
      const isPrimary = i === 0;
      const result = await this.uploadThumbnail(
        thumbnailPaths[i],
        sellerHandle,
        videoId,
        i,
        isPrimary
      );
      results.push(result);
    }

    this.logger.info('Multiple thumbnails saved locally', {
      sellerHandle,
      videoId,
      totalThumbnails: thumbnailPaths.length,
      successfulSaves: results.filter(r => r.success).length,
      outputDirectory: path.resolve(OUTPUT_DIR)
    });

    return results;
  }

  async checkThumbnailExists(sellerHandle, videoId) {
    // For local testing, always return false to force generation
    return false;
  }

  generateThumbnailUrl(sellerHandle, videoId) {
    return `file://${path.resolve(OUTPUT_DIR)}/${sellerHandle}-${videoId}_primary.jpg`;
  }
}

async function testLocalThumbnailGeneration() {
  console.log('🖼️  Local Thumbnail Generator Test');
  console.log('=====================================\n');

  try {
    // Check if dist directory exists
    if (!fs.existsSync('./dist')) {
      console.log('❌ dist directory not found. Building project...');
      const { spawn } = require('child_process');

      await new Promise((resolve, reject) => {
        const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
        buildProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Build completed successfully');
            resolve();
          } else {
            reject(new Error(`Build failed with code ${code}`));
          }
        });
      });
    }

    // Import the services after building
    const { VideoService } = require('./dist/services/video.service');

    // Configuration for local testing
    const config = {
      // Mock AWS settings (not used locally)
      sqsQueueUrl: 'local-test-queue',
      snsTopicArn: 'local-test-topic',
      s3BucketName: 'local-test-bucket',
      awsRegion: 'us-east-1',
      maxRetries: 3,
      batchSize: 1,
      visibilityTimeout: 900,
      waitTimeSeconds: 20,
      
      // Video processing settings (Updated for TikTok 2025 limits)
      maxVideoSizeMB: 300, // TikTok iOS limit: 287.6MB, Web: 1GB
      maxVideoDurationSeconds: 3600, // TikTok max: 60 minutes
      frameExtractionInterval: 2, // Extract frame every 2 seconds
      maxFramesToAnalyze: 15,
      thumbnailsToGenerate: 5, // Generate 5 thumbnails per video
      
      // YOLO settings
      yoloModelPath: 'yolov8n.pt',
      yoloConfidenceThreshold: 0.5,
      yoloIouThreshold: 0.5,
      
      // Quality thresholds
      minQualityScore: 0.4,
      minBrightnessScore: 0.3,
      maxBlurScore: 0.7,
      
      // Output settings (Updated for better TikTok video preservation)
      thumbnailWidth: 600, // 3:4 aspect ratio preserves TikTok content better
      thumbnailHeight: 800, // Maintains vertical orientation
      thumbnailQuality: 90 // Higher quality for better detail
    };

    console.log('Configuration:');
    console.log(`- Thumbnails per video: ${config.thumbnailsToGenerate}`);
    console.log(`- Max frames to analyze: ${config.maxFramesToAnalyze}`);
    console.log(`- Thumbnail size: ${config.thumbnailWidth}x${config.thumbnailHeight}`);
    console.log(`- Output directory: ${path.resolve(OUTPUT_DIR)}`);
    console.log('');

    const videoService = new VideoService(config);
    const localS3Service = new LocalS3Service(config.s3BucketName, config.awsRegion);

    let totalProcessed = 0;
    let totalFailed = 0;

    for (let i = 0; i < testVideoUrls.length; i++) {
      const videoUrl = testVideoUrls[i];
      const videoId = `test_video_${Date.now()}_${i}`;
      const sellerHandle = `test-seller-${i + 1}`;
      
      console.log(`\n📹 Processing Video ${i + 1}/${testVideoUrls.length}`);
      console.log(`Video URL: ${videoUrl}`);
      console.log(`Video ID: ${videoId}`);
      console.log(`Seller: ${sellerHandle}`);
      console.log('---');

      try {
        const startTime = Date.now();
        
        // Process video to generate thumbnails
        console.log('🔄 Starting video processing...');
        const result = await videoService.processVideo(videoUrl, videoId);
        
        if (result.success && result.thumbnails.length > 0) {
          console.log(`✅ Video processing successful!`);
          console.log(`   📊 Thumbnails generated: ${result.thumbnails.length}`);
          console.log(`   🎯 Frames analyzed: ${result.frames_analyzed}`);
          console.log(`   ⏱️  Video duration: ${result.video_duration}s`);
          console.log(`   🕒 Processing time: ${Date.now() - startTime}ms`);
          
          // Save thumbnails locally
          console.log('💾 Saving thumbnails locally...');
          const thumbnailPaths = result.thumbnails.map(t => t.thumbnail_path);
          const saveResults = await localS3Service.uploadMultipleThumbnails(
            thumbnailPaths,
            sellerHandle,
            videoId
          );
          
          const successfulSaves = saveResults.filter(r => r.success);
          console.log(`✅ Saved ${successfulSaves.length}/${saveResults.length} thumbnails`);
          
          // Log details about each thumbnail
          result.thumbnails.forEach((thumb, idx) => {
            const saveResult = saveResults[idx];
            if (saveResult.success) {
              console.log(`   📸 Thumbnail ${idx + 1}: ${path.basename(saveResult.s3Url.replace('file://', ''))}`);
              console.log(`      Frame: ${thumb.frame_analysis.frame_index} (${thumb.frame_analysis.timestamp}s)`);
              console.log(`      Quality: ${thumb.frame_analysis.quality_score.toFixed(2)}`);
              console.log(`      Has Product: ${thumb.frame_analysis.has_product ? 'Yes' : 'No'}`);
            }
          });
          
          totalProcessed++;
          
        } else {
          console.log(`❌ Video processing failed: ${result.error}`);
          totalFailed++;
        }
        
      } catch (error) {
        console.log(`❌ Error processing video: ${error.message}`);
        totalFailed++;
      }
    }

    // Summary
    console.log('\n🎉 Local Testing Complete!');
    console.log('==========================');
    console.log(`✅ Successfully processed: ${totalProcessed} videos`);
    console.log(`❌ Failed: ${totalFailed} videos`);
    console.log(`📁 Output directory: ${path.resolve(OUTPUT_DIR)}`);
    
    if (totalProcessed > 0) {
      console.log('\n📋 Generated Files:');
      const files = fs.readdirSync(OUTPUT_DIR);
      files.forEach(file => {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        console.log(`   📸 ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    }

  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    console.error('Make sure to run "npm run build" first!');
    process.exit(1);
  }
}

// Check if we're running this script directly
if (require.main === module) {
  testLocalThumbnailGeneration().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testLocalThumbnailGeneration };
