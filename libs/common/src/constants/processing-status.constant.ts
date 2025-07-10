export const PROCESSING_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export const PROCESSING_TYPE = {
  CAPTION_ANALYSIS: 'caption_analysis',
  THUMBNAIL_GENERATION: 'thumbnail_generation',
  AUTO_TAGGING: 'auto_tagging',
  PRODUCT_EXTRACTION: 'product_extraction',
  FULL_PROCESSING: 'full_processing'
} as const;

export const PROCESSING_PRIORITY = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4
} as const;

export const PROCESSING_TIMEOUT = {
  CAPTION_ANALYSIS: 300, // 5 minutes
  THUMBNAIL_GENERATION: 600, // 10 minutes
  AUTO_TAGGING: 180, // 3 minutes
  PRODUCT_EXTRACTION: 240, // 4 minutes
  FULL_PROCESSING: 900 // 15 minutes
} as const;

export type ProcessingStatusType = typeof PROCESSING_STATUS[keyof typeof PROCESSING_STATUS];
export type ProcessingTypeType = typeof PROCESSING_TYPE[keyof typeof PROCESSING_TYPE];
export type ProcessingPriorityType = typeof PROCESSING_PRIORITY[keyof typeof PROCESSING_PRIORITY];
