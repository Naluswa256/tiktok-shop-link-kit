import { ProcessingStatus, ProcessingType } from '../dto/processing-job.dto';

export interface IProcessingService {
  processVideo(videoId: string, type: ProcessingType, inputData?: Record<string, any>): Promise<string>;
  getJobStatus(jobId: string): Promise<ProcessingStatus>;
  cancelJob(jobId: string): Promise<boolean>;
}

export interface IProcessingResult {
  jobId: string;
  videoId: string;
  type: ProcessingType;
  status: ProcessingStatus;
  data?: Record<string, any>;
  error?: string;
  timestamp: string;
}

export interface ICaptionAnalysisResult {
  videoId: string;
  products: Array<{
    name: string;
    confidence: number;
    category?: string;
  }>;
  pricing: Array<{
    amount: number;
    currency: string;
    confidence: number;
  }>;
  callToActions: string[];
  sentiment: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  keyFeatures: string[];
  confidence: number;
}

export interface IThumbnailGenerationResult {
  videoId: string;
  thumbnails: Array<{
    size: string;
    url: string;
    type: 'original' | 'enhanced' | 'product_focused';
  }>;
  primaryThumbnail: string;
  confidence: number;
}

export interface IAutoTaggingResult {
  videoId: string;
  tags: Array<{
    tag: string;
    confidence: number;
    category: string;
    source: 'ai' | 'manual' | 'trending';
  }>;
  categories: Array<{
    category: string;
    confidence: number;
  }>;
  trendingTags: string[];
  seoKeywords: string[];
  themes: string[];
  confidence: number;
}

export interface IProcessingQueue {
  addJob(type: ProcessingType, data: Record<string, any>): Promise<string>;
  getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }>;
}
