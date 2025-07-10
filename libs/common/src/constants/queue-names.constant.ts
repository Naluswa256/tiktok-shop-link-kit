export const QUEUE_NAMES = {
  // Processing queues
  CAPTION_ANALYSIS: 'tiktok-caption-analysis-queue',
  THUMBNAIL_GENERATION: 'tiktok-thumbnail-generation-queue',
  AUTO_TAGGING: 'tiktok-auto-tagging-queue',
  PRODUCT_EXTRACTION: 'tiktok-product-extraction-queue',
  
  // Dead letter queues
  CAPTION_ANALYSIS_DLQ: 'tiktok-caption-analysis-dlq',
  THUMBNAIL_GENERATION_DLQ: 'tiktok-thumbnail-generation-dlq',
  AUTO_TAGGING_DLQ: 'tiktok-auto-tagging-dlq',
  PRODUCT_EXTRACTION_DLQ: 'tiktok-product-extraction-dlq',
  
  // Notification queues
  EMAIL_NOTIFICATIONS: 'tiktok-email-notifications-queue',
  SMS_NOTIFICATIONS: 'tiktok-sms-notifications-queue',
  PUSH_NOTIFICATIONS: 'tiktok-push-notifications-queue',
  WEBHOOK_NOTIFICATIONS: 'tiktok-webhook-notifications-queue',
  
  // WhatsApp queues
  WHATSAPP_MESSAGES: 'tiktok-whatsapp-messages-queue',
  WHATSAPP_TEMPLATES: 'tiktok-whatsapp-templates-queue',
  
  // Analytics queues
  ANALYTICS_EVENTS: 'tiktok-analytics-events-queue',
  USER_ACTIVITY: 'tiktok-user-activity-queue',
  PERFORMANCE_METRICS: 'tiktok-performance-metrics-queue'
} as const;

export const TOPIC_NAMES = {
  // Processing topics
  VIDEO_PROCESSING_STARTED: 'tiktok-video-processing-started',
  VIDEO_PROCESSING_COMPLETED: 'tiktok-video-processing-completed',
  VIDEO_PROCESSING_FAILED: 'tiktok-video-processing-failed',
  
  // AI processing topics
  CAPTION_ANALYSIS_COMPLETED: 'tiktok-caption-analysis-completed',
  THUMBNAIL_GENERATION_COMPLETED: 'tiktok-thumbnail-generation-completed',
  AUTO_TAGGING_COMPLETED: 'tiktok-auto-tagging-completed',
  
  // Product topics
  PRODUCT_CREATED: 'tiktok-product-created',
  PRODUCT_UPDATED: 'tiktok-product-updated',
  PRODUCT_DELETED: 'tiktok-product-deleted',
  PRODUCT_OUT_OF_STOCK: 'tiktok-product-out-of-stock',
  
  // User topics
  USER_REGISTERED: 'tiktok-user-registered',
  USER_VERIFIED: 'tiktok-user-verified',
  USER_SUBSCRIPTION_CHANGED: 'tiktok-user-subscription-changed',
  
  // System topics
  SYSTEM_HEALTH_CHECK: 'tiktok-system-health-check',
  SYSTEM_ALERT: 'tiktok-system-alert',
  CACHE_INVALIDATION: 'tiktok-cache-invalidation'
} as const;

export const EXCHANGE_NAMES = {
  // Main exchanges
  PROCESSING: 'tiktok-processing-exchange',
  NOTIFICATIONS: 'tiktok-notifications-exchange',
  ANALYTICS: 'tiktok-analytics-exchange',
  SYSTEM: 'tiktok-system-exchange'
} as const;

export const ROUTING_KEYS = {
  // Processing routing keys
  CAPTION_ANALYSIS: 'processing.caption.analysis',
  THUMBNAIL_GENERATION: 'processing.thumbnail.generation',
  AUTO_TAGGING: 'processing.auto.tagging',
  PRODUCT_EXTRACTION: 'processing.product.extraction',
  
  // Notification routing keys
  EMAIL: 'notification.email',
  SMS: 'notification.sms',
  PUSH: 'notification.push',
  WEBHOOK: 'notification.webhook',
  
  // Priority routing keys
  HIGH_PRIORITY: 'priority.high',
  NORMAL_PRIORITY: 'priority.normal',
  LOW_PRIORITY: 'priority.low',
  
  // Error routing keys
  PROCESSING_ERROR: 'error.processing',
  SYSTEM_ERROR: 'error.system',
  VALIDATION_ERROR: 'error.validation'
} as const;

export type QueueNameType = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
export type TopicNameType = typeof TOPIC_NAMES[keyof typeof TOPIC_NAMES];
export type ExchangeNameType = typeof EXCHANGE_NAMES[keyof typeof EXCHANGE_NAMES];
export type RoutingKeyType = typeof ROUTING_KEYS[keyof typeof ROUTING_KEYS];
