/**
 * Types for Caption Parser Worker
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

export interface ParsedCaptionData {
  title: string;
  price: number | null;
  sizes: string | null;
  tags: string[];
  confidence_score: number;
}

export interface LLMResponse {
  title: string;
  price: string | number | null;
  sizes: string | null;
  tags: string[]; // Can be empty array if no clear category tags
  reasoning?: string;
}

export interface SQSMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, any>;
}

export interface WorkerConfig {
  sqsQueueUrl: string;
  snsTopicArn: string;
  awsRegion: string;
  llmProvider: 'openrouter' | 'ollama' | 'openai';
  llmApiKey?: string | undefined;
  llmModel: string;
  ollamaBaseUrl?: string | undefined;
  maxRetries: number;
  batchSize: number;
  visibilityTimeout: number;
  waitTimeSeconds: number;
}

export interface ProcessingResult {
  success: boolean;
  messageId: string;
  videoId?: string;
  error?: string;
  processingTime?: number;
}
