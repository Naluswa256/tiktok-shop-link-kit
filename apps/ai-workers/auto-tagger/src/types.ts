/**
 * Types for Auto-Tagger Worker
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

export interface TagsGeneratedEvent {
  video_id: string;
  seller_handle: string;
  extra_tags: string[];
  semantic_tags: string[];
  category_tags: string[];
  confidence_scores: Record<string, number>;
  tagging_metadata: {
    caption_analyzed: boolean;
    thumbnail_analyzed: boolean;
    llm_provider: string;
    processing_time_ms: number;
    total_tags_generated: number;
  };
  timestamp: string;
}

export interface SemanticAnalysisResult {
  semantic_tags: string[];
  category_tags: string[];
  confidence_scores: Record<string, number>;
  reasoning?: string;
}

export interface TaggingConfig {
  maxTags: number;
  minConfidence: number;
  enableCategoryTagging: boolean;
  enableSemanticTagging: boolean;
  categoryMappings: Record<string, string[]>;
}

export interface WorkerConfig {
  sqsQueueUrl: string;
  snsTopicArn: string;
  awsRegion: string;
  llmProvider: 'openrouter' | 'ollama' | 'openai';
  llmApiKey?: string;
  llmModel: string;
  ollamaBaseUrl?: string;
  maxRetries: number;
  batchSize: number;
  visibilityTimeout: number;
  waitTimeSeconds: number;
  taggingConfig: TaggingConfig;
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
  tagsGenerated?: number;
}
