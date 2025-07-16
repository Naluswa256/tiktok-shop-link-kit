import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TikTokVideo {
  id: string;
  webVideoUrl: string;
  text: string; // caption
  createTime: number;
  stats: {
    diggCount: number;
    shareCount: number;
    commentCount: number;
    playCount: number;
  };
  author: {
    uniqueId: string;
    nickname: string;
    avatarThumb: string;
    verified: boolean;
    followerCount: number;
  };
  music?: {
    title: string;
    authorName: string;
  };
}

export interface ApifyRunResult {
  videos: TikTokVideo[];
  totalVideos: number;
  handle: string;
}

export interface ApifyUsageStats {
  computeUnitsUsed: number;
  remainingComputeUnits: number;
  dailyUsage: number;
}

@Injectable()
export class ApifyService {
  private readonly logger = new Logger(ApifyService.name);
  private readonly apifyToken: string;
  private readonly actorId: string;
  private readonly baseUrl = 'https://api.apify.com/v2';
  
  // Track daily usage to stay within free tier limits
  private dailyUsage = 0;
  private lastResetDate = new Date().toDateString();
  private readonly maxDailyUsage = 300; // Conservative limit for free tier (10k CU/month ≈ 333 CU/day)

  constructor(private readonly configService: ConfigService) {
    this.apifyToken = this.configService.get('APIFY_TOKEN', '');
    this.actorId = this.configService.get('APIFY_ACTOR_ID', 'clockworks/tiktok-profile-scraper');
    
    if (!this.apifyToken) {
      this.logger.warn('APIFY_TOKEN not configured - Apify service will not work');
    }
  }

  /**
   * Extract TikTok videos for a given handle
   */
  async extractVideos(handle: string, maxVideos: number = 20): Promise<ApifyRunResult> {
    if (!this.apifyToken) {
      throw new Error('Apify token not configured');
    }

    // Check daily usage limits
    this.checkDailyUsage();
    
    if (this.dailyUsage >= this.maxDailyUsage) {
      throw new Error(`Daily Apify usage limit reached (${this.maxDailyUsage} CU). Try again tomorrow.`);
    }

    const runInput = {
      profiles: [`https://www.tiktok.com/@${handle}`],
      resultsLimit: maxVideos,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadVideos: false,
      shouldDownloadSubtitles: false,
    };

    try {
      this.logger.log(`Starting Apify extraction for handle: ${handle}`);
      
      // Start the actor run
      const runResponse = await this.makeApifyRequest('POST', `/acts/${this.actorId}/runs`, {
        body: JSON.stringify(runInput),
      });

      if (!runResponse.data?.id) {
        throw new Error('Failed to start Apify run');
      }

      const runId = runResponse.data.id;
      this.logger.log(`Apify run started with ID: ${runId}`);

      // Wait for the run to complete
      const result = await this.waitForRunCompletion(runId);
      
      // Get the dataset items
      const videos = await this.getDatasetItems(result.defaultDatasetId);
      
      // Update usage tracking
      this.updateUsageTracking(result.stats?.computeUnits || 10);
      
      this.logger.log(`Extracted ${videos.length} videos for handle: ${handle}`);
      
      return {
        videos,
        totalVideos: videos.length,
        handle,
      };
      
    } catch (error) {
      this.logger.error(`Failed to extract videos for handle: ${handle}`, error);
      throw error;
    }
  }

  /**
   * Filter videos that contain #TRACK hashtag
   */
  filterTrackedVideos(videos: TikTokVideo[]): TikTokVideo[] {
    return videos.filter(video => {
      const caption = video.text?.toLowerCase() || '';
      return caption.includes('#track') || caption.includes('# track');
    });
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): ApifyUsageStats {
    return {
      computeUnitsUsed: this.dailyUsage,
      remainingComputeUnits: Math.max(0, this.maxDailyUsage - this.dailyUsage),
      dailyUsage: this.dailyUsage,
    };
  }

  /**
   * Check if we can make another API call within limits
   */
  canMakeApiCall(estimatedCost: number = 10): boolean {
    this.checkDailyUsage();
    return (this.dailyUsage + estimatedCost) <= this.maxDailyUsage;
  }

  private async makeApifyRequest(method: string, endpoint: string, options: any = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apifyToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      method,
      headers,
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  private async waitForRunCompletion(runId: string, maxWaitTime: number = 300000): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const runStatus = await this.makeApifyRequest('GET', `/actor-runs/${runId}`);
      
      if (runStatus.data.status === 'SUCCEEDED') {
        return runStatus.data;
      }
      
      if (runStatus.data.status === 'FAILED' || runStatus.data.status === 'ABORTED') {
        throw new Error(`Apify run failed with status: ${runStatus.data.status}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Apify run timed out');
  }

  private async getDatasetItems(datasetId: string): Promise<TikTokVideo[]> {
    try {
      const response = await this.makeApifyRequest('GET', `/datasets/${datasetId}/items`);
      return response || [];
    } catch (error) {
      this.logger.error(`Failed to get dataset items for dataset: ${datasetId}`, error);
      return [];
    }
  }

  private checkDailyUsage(): void {
    const currentDate = new Date().toDateString();
    if (currentDate !== this.lastResetDate) {
      // Reset daily usage for new day
      this.dailyUsage = 0;
      this.lastResetDate = currentDate;
      this.logger.log('Daily Apify usage reset');
    }
  }

  private updateUsageTracking(computeUnits: number): void {
    this.dailyUsage += computeUnits;
    this.logger.log(`Apify usage updated: ${this.dailyUsage}/${this.maxDailyUsage} CU used today`);
    
    if (this.dailyUsage >= this.maxDailyUsage * 0.8) {
      this.logger.warn(`Approaching daily Apify usage limit: ${this.dailyUsage}/${this.maxDailyUsage} CU`);
    }
  }
}
