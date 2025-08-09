#!/usr/bin/env node

/**
 * CLI Thumbnail Generator
 * 
 * Usage:
 *   node generate-thumbnails-cli.js "https://www.tiktok.com/@user/video/123"
 *   node generate-thumbnails-cli.js "url1" "url2" "url3"
 *   node generate-thumbnails-cli.js --file urls.txt
 * 
 * This script runs the thumbnail generation pipeline locally without AWS dependencies.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Local output directory
const OUTPUT_DIR = './generated_thumbnails';

// Default test URLs if none provided
const DEFAULT_TEST_URLS = [
  "https://www.tiktok.com/@nalu-fashion/video/7234567890123456789",
  "https://www.tiktok.com/@fashionqueen/video/7234567890123456790",
];

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('ℹ️  No URLs provided, using default test URLs');
    return DEFAULT_TEST_URLS;
  }
  
  // Check if --file flag is used
  if (args[0] === '--file' && args[1]) {
    const filePath = args[1];
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const urls = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    console.log(`📁 Loaded ${urls.length} URLs from ${filePath}`);
    return urls;
  }
  
  // Use provided URLs
  return args;
}

// Mock S3 Service for local testing
class LocalS3Service {
  constructor() {
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
      
      console.log(`💾 Saved: ${path.basename(localPath)} (${Math.round(stats.size / 1024)}KB)`);

      return {
        success: true,
        s3Key: `local/${sellerHandle}/${fileName}`,
        s3Url: `file://${path.resolve(localPath)}`
      };

    } catch (error) {
      console.error(`❌ Failed to save thumbnail: ${error.message}`);
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

    return results;
  }
}

async function buildIfNeeded() {
  if (!fs.existsSync('./dist')) {
    console.log('🔨 Building project...');
    const { spawn } = require('child_process');
    
    await new Promise((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Build completed');
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
    });
  }
}

async function generateThumbnails(videoUrls) {
  console.log('🖼️  Thumbnail Generator CLI');
  console.log('============================\n');

  try {
    await buildIfNeeded();

    // Import the VideoService
    const { VideoService } = require('./dist/services/video.service');

    // Configuration
    const config = {
      sqsQueueUrl: 'local-test',
      snsTopicArn: 'local-test',
      s3BucketName: 'local-test',
      awsRegion: 'us-east-1',
      maxRetries: 3,
      batchSize: 1,
      visibilityTimeout: 900,
      waitTimeSeconds: 20,
      maxVideoSizeMB: 300, // TikTok iOS limit: 287.6MB, Web: 1GB
      maxVideoDurationSeconds: 3600, // TikTok max: 60 minutes
      frameExtractionInterval: 2,
      maxFramesToAnalyze: 15,
      thumbnailsToGenerate: 5,
      yoloModelPath: 'yolov8n.pt',
      yoloConfidenceThreshold: 0.5,
      yoloIouThreshold: 0.5,
      minQualityScore: 0.4,
      minBrightnessScore: 0.3,
      maxBlurScore: 0.7,
      thumbnailWidth: 600, // 3:4 aspect ratio preserves TikTok content better
      thumbnailHeight: 800, // Maintains vertical orientation
      thumbnailQuality: 90 // Higher quality for better detail
    };

    console.log(`📊 Configuration:`);
    console.log(`   Thumbnails per video: ${config.thumbnailsToGenerate}`);
    console.log(`   Output directory: ${path.resolve(OUTPUT_DIR)}`);
    console.log(`   Videos to process: ${videoUrls.length}\n`);

    const videoService = new VideoService(config);
    const localS3Service = new LocalS3Service();

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < videoUrls.length; i++) {
      const videoUrl = videoUrls[i];
      const videoId = `video_${Date.now()}_${i}`;
      const sellerHandle = `seller-${i + 1}`;
      
      console.log(`\n📹 Processing ${i + 1}/${videoUrls.length}: ${videoUrl}`);
      console.log('─'.repeat(60));

      try {
        const startTime = Date.now();
        
        // Process video
        const result = await videoService.processVideo(videoUrl, videoId);
        
        if (result.success && result.thumbnails.length > 0) {
          console.log(`✅ Processing successful!`);
          console.log(`   📊 Generated: ${result.thumbnails.length} thumbnails`);
          console.log(`   🎯 Analyzed: ${result.frames_analyzed} frames`);
          console.log(`   ⏱️  Duration: ${result.video_duration}s`);
          console.log(`   🕒 Time: ${Date.now() - startTime}ms`);
          
          // Save thumbnails
          const thumbnailPaths = result.thumbnails.map(t => t.thumbnail_path);
          await localS3Service.uploadMultipleThumbnails(
            thumbnailPaths,
            sellerHandle,
            videoId
          );
          
          // Log frame details
          result.thumbnails.forEach((thumb, idx) => {
            const frame = thumb.frame_analysis;
            console.log(`   📸 Thumbnail ${idx + 1}: Frame ${frame.frame_index} (${frame.timestamp}s) - Quality: ${frame.quality_score.toFixed(2)}`);
          });
          
          processed++;
          
        } else {
          console.log(`❌ Processing failed: ${result.error}`);
          failed++;
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        failed++;
      }
    }

    // Summary
    console.log('\n🎉 Processing Complete!');
    console.log('========================');
    console.log(`✅ Processed: ${processed} videos`);
    console.log(`❌ Failed: ${failed} videos`);
    console.log(`📁 Output: ${path.resolve(OUTPUT_DIR)}`);
    
    if (processed > 0) {
      console.log('\n📸 Generated Files:');
      const files = fs.readdirSync(OUTPUT_DIR);
      files.forEach(file => {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        console.log(`   ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Show usage if --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🖼️  Thumbnail Generator CLI

Usage:
  node generate-thumbnails-cli.js "https://www.tiktok.com/@user/video/123"
  node generate-thumbnails-cli.js "url1" "url2" "url3"
  node generate-thumbnails-cli.js --file urls.txt

Options:
  --file <path>    Read URLs from a text file (one per line)
  --help, -h       Show this help message

Examples:
  node generate-thumbnails-cli.js "https://www.tiktok.com/@nalu-fashion/video/123"
  echo "https://www.tiktok.com/@user/video/123" > urls.txt && node generate-thumbnails-cli.js --file urls.txt
`);
  process.exit(0);
}

// Main execution
if (require.main === module) {
  const videoUrls = parseArguments();
  generateThumbnails(videoUrls).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
