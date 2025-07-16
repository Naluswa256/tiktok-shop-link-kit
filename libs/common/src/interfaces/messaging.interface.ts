export interface IMessageService {
  publishMessage(topic: string, message: IMessage): Promise<string>;
  subscribeToTopic(topic: string, handler: IMessageHandler): Promise<void>;
  sendToQueue(queueName: string, message: IMessage): Promise<string>;
  receiveFromQueue(queueName: string, handler: IMessageHandler): Promise<void>;
}

export interface IMessage {
  id?: string;
  type: string;
  data: Record<string, any>;
  timestamp?: string;
  correlationId?: string;
  source?: string;
  version?: string;
}

export interface IMessageHandler {
  (message: IMessage): Promise<void>;
}

export interface IEventBus {
  emit(eventName: string, data: Record<string, any>): Promise<void>;
  on(eventName: string, handler: IEventHandler): void;
  off(eventName: string, handler: IEventHandler): void;
  once(eventName: string, handler: IEventHandler): void;
}

export interface IEventHandler {
  (data: Record<string, any>): Promise<void> | void;
}

export interface INotificationService {
  sendEmail(to: string, subject: string, body: string, isHtml?: boolean): Promise<boolean>;
  sendSMS(to: string, message: string): Promise<boolean>;
  sendPushNotification(deviceToken: string, title: string, body: string, data?: Record<string, any>): Promise<boolean>;
  sendWebhook(url: string, data: Record<string, any>, headers?: Record<string, string>): Promise<boolean>;
}

export interface IWebhookPayload {
  event: string;
  data: Record<string, any>;
  timestamp: string;
  signature?: string;
  version: string;
}

export interface IQueueConfig {
  name: string;
  url: string;
  visibilityTimeout?: number;
  messageRetentionPeriod?: number;
  deadLetterQueue?: {
    name: string;
    maxReceiveCount: number;
  };
}

export interface ITopicConfig {
  name: string;
  arn: string;
  subscriptions?: Array<{
    protocol: 'sqs' | 'email' | 'http' | 'https' | 'lambda';
    endpoint: string;
  }>;
}

// Event Schemas for TikTok Commerce Platform

/**
 * VideoPostedEvent - Emitted when a new TikTok video with #TRACK is detected
 * This event triggers the ingestion pipeline for processing the video
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

/**
 * ProductProcessedEvent - Emitted when all AI workers have completed processing
 */
export interface ProductProcessedEvent {
  video_id: string;
  seller_handle: string;
  product_data: {
    title?: string;
    description?: string;
    price?: number;
    currency?: string;
    category?: string;
    tags?: string[];
    thumbnail_url?: string;
    extracted_text?: string;
  };
  processing_results: {
    caption_parser: {
      status: 'success' | 'failed';
      result?: any;
      error?: string;
    };
    thumbnail_generator: {
      status: 'success' | 'failed';
      result?: any;
      error?: string;
    };
    auto_tagger: {
      status: 'success' | 'failed';
      result?: any;
      error?: string;
    };
  };
  timestamp: string;
}

/**
 * ShopLinkGeneratedEvent - Emitted when a new shop link is created
 */
export interface ShopLinkGeneratedEvent {
  handle: string;
  phone: string;
  shop_link: string;
  subscription_status: 'trial' | 'paid';
  created_at: string;
}
