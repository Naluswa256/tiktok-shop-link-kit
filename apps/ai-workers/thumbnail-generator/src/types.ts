/**
 * Types for Thumbnail Generator Worker
 */

export interface VideoPostedEvent {
  video_id: string;
  caption: string;
  seller_handle: string;
  video_url: string;
  timestamp?: string;
  metadata?: {
    likes_count?: number;
    comments_count?: number;
    shares_count?: number;
    duration?: number;
    thumbnail_url?: string;
  };
}

export interface ThumbnailInfo {
  thumbnail_url: string;
  thumbnail_s3_key: string;
  frame_timestamp: number;
  frame_index: number;
  confidence_score: number;
  quality_score: number;
  detected_objects?: DetectedObject[];
  is_primary: boolean; // Mark the best thumbnail as primary
}

export interface ThumbnailGeneratedEvent {
  video_id: string;
  seller_handle: string;
  thumbnails: ThumbnailInfo[]; // Array of multiple thumbnails
  primary_thumbnail: ThumbnailInfo; // The best thumbnail for main display
  processing_metadata: {
    video_duration: number;
    frames_analyzed: number;
    thumbnails_generated: number;
    processing_time_ms: number;
  };
  timestamp: string;
}

export interface DetectedObject {
  class_name: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FrameAnalysis {
  frame_index: number;
  timestamp: number;
  quality_score: number;
  detected_objects: DetectedObject[];
  has_product: boolean;
  blur_score: number;
  brightness_score: number;
  composition_score: number;
}

export interface ThumbnailResult {
  thumbnail_path: string;
  s3_key: string;
  s3_url: string;
  frame_analysis: FrameAnalysis;
}

export interface VideoProcessingResult {
  success: boolean;
  thumbnails: ThumbnailResult[];
  primary_thumbnail?: ThumbnailResult;
  error?: string;
  processing_time: number;
  frames_analyzed: number;
  video_duration: number;
}

export interface WorkerConfig {
  sqsQueueUrl: string;
  snsTopicArn: string;
  s3BucketName: string;
  awsRegion: string;
  maxRetries: number;
  batchSize: number;
  visibilityTimeout: number;
  waitTimeSeconds: number;
  
  // Video processing settings
  maxVideoSizeMB: number;
  maxVideoDurationSeconds: number;
  frameExtractionInterval: number; // seconds
  maxFramesToAnalyze: number;
  thumbnailsToGenerate: number; // Number of thumbnails to create (e.g., 5)
  
  // YOLO settings
  yoloModelPath: string;
  yoloConfidenceThreshold: number;
  yoloIouThreshold: number;
  
  // Quality thresholds
  minQualityScore: number;
  minBrightnessScore: number;
  maxBlurScore: number;
  
  // Output settings
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailQuality: number;
}

export interface SQSMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, any>;
}

export interface ProcessingResult {
  success: boolean;
  messageId: string;
  videoId?: string;
  error?: string;
  processingTime?: number;
  thumbnailUrl?: string;
}
