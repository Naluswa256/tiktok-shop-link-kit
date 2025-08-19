import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from './ingestion.service';
import { ApifyService } from './apify.service';
import { MonitoringService } from './monitoring.service';

export interface IngestionRequest {
  handle: string;
  mode: 'on-demand' | 'short-polling' | 'scheduled';
  priority: 'high' | 'medium' | 'low';
  maxVideos?: number;
  requestedBy?: string;
}

export interface IngestionResult {
  success: boolean;
  handle: string;
  videosFound: number;
  newVideos: number;
  cuUsed: number;
  duration: number;
  error?: string;
}

@Injectable()
export class IngestionCoordinatorService {
  private readonly logger = new Logger(IngestionCoordinatorService.name);
  
  // Rate limiting and quota management
  private readonly onDemandQueue: IngestionRequest[] = [];
  private readonly shortPollingQueue: IngestionRequest[] = [];
  private readonly processingRequests = new Set<string>();
  
  // Configuration
  private readonly maxConcurrentRuns: number;
  private readonly onDemandRateLimit: number; // requests per minute
  private readonly shortPollingInterval: number; // minutes
  private readonly globalMonthlyCuCap: number;
  
  // Usage tracking
  private onDemandRequestsThisMinute = 0;
  private lastRateLimitReset = Date.now();
  private monthlyCuUsage = 0;
  private lastMonthlyReset = new Date().getMonth();

  constructor(
    private readonly configService: ConfigService,
    private readonly ingestionService: IngestionService,
    private readonly apifyService: ApifyService,
    private readonly monitoringService: MonitoringService,
  ) {
    this.maxConcurrentRuns = this.configService.get('INGESTION_MAX_CONCURRENT', 3);
    this.onDemandRateLimit = this.configService.get('INGESTION_ON_DEMAND_RATE_LIMIT', 10);
    this.shortPollingInterval = this.configService.get('INGESTION_SHORT_POLLING_INTERVAL', 5);
    this.globalMonthlyCuCap = this.configService.get('INGESTION_MONTHLY_CU_CAP', 8000); // ~$3200 at $0.4/CU
    
    // Start processing queues
    this.startQueueProcessing();
  }

  /**
   * Request immediate ingestion for a seller (on-demand)
   */
  async requestOnDemandIngestion(handle: string, requestedBy?: string): Promise<{ queued: boolean; position?: number; error?: string }> {
    try {
      // Check rate limits
      this.checkRateLimits();
      
      if (this.onDemandRequestsThisMinute >= this.onDemandRateLimit) {
        return {
          queued: false,
          error: `Rate limit exceeded. Try again in ${60 - Math.floor((Date.now() - this.lastRateLimitReset) / 1000)} seconds.`
        };
      }

      // Check global CU budget
      if (this.monthlyCuUsage >= this.globalMonthlyCuCap) {
        return {
          queued: false,
          error: 'Monthly compute unit budget exceeded. Please try again next month.'
        };
      }

      // Check if already processing or queued
      if (this.processingRequests.has(handle) || this.onDemandQueue.some(req => req.handle === handle)) {
        return {
          queued: false,
          error: 'Ingestion already in progress or queued for this seller.'
        };
      }

      // Add to queue
      const request: IngestionRequest = {
        handle,
        mode: 'on-demand',
        priority: 'high',
        maxVideos: 50,
        requestedBy,
      };

      this.onDemandQueue.push(request);
      this.onDemandRequestsThisMinute++;

      this.logger.log(`On-demand ingestion queued for ${handle} (position: ${this.onDemandQueue.length})`);

      return {
        queued: true,
        position: this.onDemandQueue.length,
      };

    } catch (error) {
      this.logger.error(`Failed to queue on-demand ingestion for ${handle}`, error);
      return {
        queued: false,
        error: 'Internal error. Please try again later.'
      };
    }
  }

  /**
   * Add seller to short-polling queue (for paid/active sellers)
   */
  async enableShortPolling(handle: string, priority: 'high' | 'medium' = 'medium'): Promise<boolean> {
    try {
      // Check if already in short polling
      if (this.shortPollingQueue.some(req => req.handle === handle)) {
        return true;
      }

      const request: IngestionRequest = {
        handle,
        mode: 'short-polling',
        priority,
        maxVideos: 20,
      };

      this.shortPollingQueue.push(request);
      this.logger.log(`Short polling enabled for ${handle} with priority ${priority}`);

      return true;
    } catch (error) {
      this.logger.error(`Failed to enable short polling for ${handle}`, error);
      return false;
    }
  }

  /**
   * Remove seller from short-polling queue
   */
  async disableShortPolling(handle: string): Promise<boolean> {
    const index = this.shortPollingQueue.findIndex(req => req.handle === handle);
    if (index >= 0) {
      this.shortPollingQueue.splice(index, 1);
      this.logger.log(`Short polling disabled for ${handle}`);
      return true;
    }
    return false;
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      onDemandQueue: this.onDemandQueue.length,
      shortPollingQueue: this.shortPollingQueue.length,
      processing: this.processingRequests.size,
      maxConcurrent: this.maxConcurrentRuns,
      rateLimitRemaining: Math.max(0, this.onDemandRateLimit - this.onDemandRequestsThisMinute),
      monthlyCuUsed: this.monthlyCuUsage,
      monthlyCuRemaining: Math.max(0, this.globalMonthlyCuCap - this.monthlyCuUsage),
    };
  }

  /**
   * Process ingestion queues
   */
  private async startQueueProcessing() {
    // Process on-demand queue (highest priority)
    setInterval(async () => {
      await this.processOnDemandQueue();
    }, 5000); // Check every 5 seconds

    // Process short-polling queue
    setInterval(async () => {
      await this.processShortPollingQueue();
    }, this.shortPollingInterval * 60 * 1000); // Check every N minutes

    this.logger.log('Ingestion queue processing started');
  }

  private async processOnDemandQueue() {
    if (this.onDemandQueue.length === 0 || this.processingRequests.size >= this.maxConcurrentRuns) {
      return;
    }

    const request = this.onDemandQueue.shift();
    if (!request) return;

    await this.processIngestionRequest(request);
  }

  private async processShortPollingQueue() {
    if (this.shortPollingQueue.length === 0 || this.processingRequests.size >= this.maxConcurrentRuns) {
      return;
    }

    // Process high priority first, then medium
    const highPriorityRequests = this.shortPollingQueue.filter(req => req.priority === 'high');
    const mediumPriorityRequests = this.shortPollingQueue.filter(req => req.priority === 'medium');
    
    const availableSlots = this.maxConcurrentRuns - this.processingRequests.size;
    const requestsToProcess = [...highPriorityRequests, ...mediumPriorityRequests].slice(0, availableSlots);

    for (const request of requestsToProcess) {
      // Don't process if already processing
      if (!this.processingRequests.has(request.handle)) {
        await this.processIngestionRequest(request);
      }
    }
  }

  private async processIngestionRequest(request: IngestionRequest): Promise<IngestionResult> {
    const startTime = Date.now();
    this.processingRequests.add(request.handle);

    try {
      this.logger.log(`Processing ${request.mode} ingestion for ${request.handle}`);

      // Check if we can make Apify call
      if (!this.apifyService.canMakeApiCall()) {
        throw new Error('Daily Apify limit reached');
      }

      // Process the shop
      const result = await this.ingestionService.processShop({
        handle: request.handle,
        phone: '', // Not needed for ingestion
        subscription_status: 'trial', // Default status
        created_at: new Date().toISOString(),
      });

      const duration = Date.now() - startTime;
      const cuUsed = result.cuUsed;

      // Update monthly usage tracking
      this.updateMonthlyCuUsage(cuUsed);

      // Send metrics
      await this.monitoringService.sendCustomMetric(
        'IngestionRequestProcessed',
        1,
        undefined,
        [
          { Name: 'Mode', Value: request.mode },
          { Name: 'Priority', Value: request.priority },
          { Name: 'Success', Value: result.success.toString() },
        ]
      );

      const ingestionResult: IngestionResult = {
        success: result.success,
        handle: request.handle,
        videosFound: result.videosFound,
        newVideos: result.newVideos,
        cuUsed,
        duration,
      };

      this.logger.log(`Completed ${request.mode} ingestion for ${request.handle}: ${result.newVideos} new videos in ${duration}ms`);

      return ingestionResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed ${request.mode} ingestion for ${request.handle}`, error);

      await this.monitoringService.sendErrorMetrics({
        errorType: 'IngestionRequestFailed',
        shopHandle: request.handle,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        handle: request.handle,
        videosFound: 0,
        newVideos: 0,
        cuUsed: 0,
        duration,
        error: error.message,
      };

    } finally {
      this.processingRequests.delete(request.handle);
    }
  }

  private checkRateLimits() {
    const now = Date.now();
    const minutesSinceReset = Math.floor((now - this.lastRateLimitReset) / 60000);
    
    if (minutesSinceReset >= 1) {
      this.onDemandRequestsThisMinute = 0;
      this.lastRateLimitReset = now;
    }

    // Check monthly reset
    const currentMonth = new Date().getMonth();
    if (currentMonth !== this.lastMonthlyReset) {
      this.monthlyCuUsage = 0;
      this.lastMonthlyReset = currentMonth;
      this.logger.log('Monthly CU usage reset');
    }
  }

  private updateMonthlyCuUsage(cuUsed: number) {
    this.monthlyCuUsage += cuUsed;
    
    // Alert when approaching limit
    const usagePercent = (this.monthlyCuUsage / this.globalMonthlyCuCap) * 100;
    if (usagePercent >= 80) {
      this.logger.warn(`Monthly CU usage at ${usagePercent.toFixed(1)}%: ${this.monthlyCuUsage}/${this.globalMonthlyCuCap}`);
    }
  }
}
