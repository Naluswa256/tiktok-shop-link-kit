import { WorkerConfig } from './types';

export function loadConfig(): WorkerConfig {
  // Validate required environment variables
  const requiredVars = [
    'SQS_QUEUE_URL',
    'SNS_TOPIC_ARN',
    'S3_BUCKET_NAME',
    'AWS_REGION'
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Required environment variable ${varName} is not set`);
    }
  }

  const config: WorkerConfig = {
    // AWS Configuration
    sqsQueueUrl: process.env.SQS_QUEUE_URL!,
    snsTopicArn: process.env.SNS_TOPIC_ARN!,
    s3BucketName: process.env.S3_BUCKET_NAME!,
    awsRegion: process.env.AWS_REGION!,

    // Worker Configuration
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    batchSize: parseInt(process.env.BATCH_SIZE || '1'), // Process one video at a time
    visibilityTimeout: parseInt(process.env.VISIBILITY_TIMEOUT || '900'), // 15 minutes for video processing
    waitTimeSeconds: parseInt(process.env.WAIT_TIME_SECONDS || '20'),

    // Video Processing Settings (Updated for TikTok 2025 limits)
    maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB || '300'), // TikTok iOS limit: 287.6MB, Web: 1GB
    maxVideoDurationSeconds: parseInt(process.env.MAX_VIDEO_DURATION_SECONDS || '3600'), // TikTok max: 60 minutes
    frameExtractionInterval: parseInt(process.env.FRAME_EXTRACTION_INTERVAL || '2'), // Every 2 seconds
    maxFramesToAnalyze: parseInt(process.env.MAX_FRAMES_TO_ANALYZE || '15'),
    thumbnailsToGenerate: parseInt(process.env.THUMBNAILS_TO_GENERATE || '5'), // Generate 5 thumbnails

    // YOLO Settings
    yoloModelPath: process.env.YOLO_MODEL_PATH || 'yolov8n.pt',
    yoloConfidenceThreshold: parseFloat(process.env.YOLO_CONFIDENCE_THRESHOLD || '0.5'),
    yoloIouThreshold: parseFloat(process.env.YOLO_IOU_THRESHOLD || '0.5'),

    // Quality Thresholds
    minQualityScore: parseFloat(process.env.MIN_QUALITY_SCORE || '0.4'),
    minBrightnessScore: parseFloat(process.env.MIN_BRIGHTNESS_SCORE || '0.3'),
    maxBlurScore: parseFloat(process.env.MAX_BLUR_SCORE || '0.7'),

    // Output Settings (Updated for better TikTok video preservation)
    thumbnailWidth: parseInt(process.env.THUMBNAIL_WIDTH || '600'), // 3:4 aspect ratio preserves TikTok content better
    thumbnailHeight: parseInt(process.env.THUMBNAIL_HEIGHT || '800'), // Maintains vertical orientation
    thumbnailQuality: parseInt(process.env.THUMBNAIL_QUALITY || '90') // Higher quality for better detail
  };

  return config;
}

export function validateConfig(config: WorkerConfig): void {
  // Validate numeric values
  if (config.maxRetries < 1 || config.maxRetries > 10) {
    throw new Error('maxRetries must be between 1 and 10');
  }

  if (config.batchSize < 1 || config.batchSize > 5) {
    throw new Error('batchSize must be between 1 and 5 for video processing');
  }

  if (config.visibilityTimeout < 300 || config.visibilityTimeout > 43200) {
    throw new Error('visibilityTimeout must be between 300 and 43200 seconds');
  }

  if (config.maxVideoSizeMB < 1 || config.maxVideoSizeMB > 1000) {
    throw new Error('maxVideoSizeMB must be between 1 and 1000 (TikTok web limit: 1GB)');
  }

  if (config.maxVideoDurationSeconds < 1 || config.maxVideoDurationSeconds > 3600) {
    throw new Error('maxVideoDurationSeconds must be between 1 and 3600 seconds (TikTok max: 60 minutes)');
  }

  if (config.thumbnailWidth < 100 || config.thumbnailWidth > 2000) {
    throw new Error('thumbnailWidth must be between 100 and 2000');
  }

  if (config.thumbnailHeight < 100 || config.thumbnailHeight > 2000) {
    throw new Error('thumbnailHeight must be between 100 and 2000');
  }

  if (config.thumbnailQuality < 50 || config.thumbnailQuality > 100) {
    throw new Error('thumbnailQuality must be between 50 and 100');
  }
}
