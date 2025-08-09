/**
 * Event types for Product Assembly & Save Flow
 */

export interface CaptionParsedEvent {
  video_id: string;
  seller_handle: string;
  title: string;
  price: number | null;
  sizes: string | null;
  tags: string[];
  confidence_score?: number;
  raw_caption?: string;
  timestamp: string;
}

export interface ThumbnailInfo {
  thumbnail_url: string;
  thumbnail_s3_key: string;
  frame_timestamp: number;
  frame_index: number;
  confidence_score: number;
  quality_score: number;
  detected_objects?: DetectedObject[];
  is_primary: boolean;
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

export interface ThumbnailGeneratedEvent {
  video_id: string;
  seller_handle: string;
  thumbnails: ThumbnailInfo[];
  primary_thumbnail: ThumbnailInfo;
  processing_metadata: {
    video_duration: number;
    frames_analyzed: number;
    thumbnails_generated: number;
    processing_time_ms: number;
  };
  timestamp: string;
}

export interface ProductAssemblyData {
  video_id: string;
  seller_handle: string;
  caption_data?: CaptionParsedEvent;
  thumbnail_data?: ThumbnailGeneratedEvent;
  created_at: string;
  updated_at: string;
  ttl: number; // TTL for cleanup (24 hours from creation)
  is_complete: boolean;
}

export interface AssembledProduct {
  seller_handle: string;
  video_id: string;
  title: string;
  price: number | null;
  sizes: string | null;
  tags: string[];
  thumbnails: ThumbnailInfo[];
  primary_thumbnail: ThumbnailInfo;
  confidence_score?: number;
  raw_caption?: string;
  processing_metadata: {
    video_duration: number;
    frames_analyzed: number;
    thumbnails_generated: number;
    processing_time_ms: number;
  };
  created_at: string;
  updated_at: string;
}

export interface NewProductEvent {
  event_type: 'new_product';
  product: AssembledProduct;
  timestamp: string;
}

export interface SQSMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, any>;
}

export interface EventProcessingResult {
  success: boolean;
  message_id: string;
  video_id?: string;
  seller_handle?: string;
  event_type?: string;
  error?: string;
  processing_time_ms?: number;
  product_assembled?: boolean;
}
