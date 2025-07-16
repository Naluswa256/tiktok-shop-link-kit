import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { ApifyService, TikTokVideo } from './apify.service';
import { MonitoringService, IngestionMetrics, ErrorMetrics } from './monitoring.service';

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

export interface IngestionState {
  handle: string;
  last_video_ids: string[];
  last_run: string;
  status: 'running' | 'completed' | 'failed';
  videos_processed: number;
  errors?: string[];
}

export interface Shop {
  handle: string;
  phone: string;
  subscription_status: 'trial' | 'paid';
  created_at: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly snsClient: SNSClient;
  private readonly shopsTableName: string;
  private readonly productsTableName: string;
  private readonly ingestionStateTableName: string;
  private readonly newVideoPostedTopicArn: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly apifyService: ApifyService,
    private readonly monitoringService: MonitoringService,
  ) {
    this.dynamoClient = new DynamoDBClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      ...(this.configService.get('DYNAMODB_ENDPOINT') && {
        endpoint: this.configService.get('DYNAMODB_ENDPOINT'),
      }),
    });

    this.snsClient = new SNSClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    });

    this.shopsTableName = this.configService.get('DYNAMODB_SHOPS_TABLE', 'tiktok-commerce-dev-shops');
    this.productsTableName = this.configService.get('DYNAMODB_PRODUCTS_TABLE', 'tiktok-commerce-dev-products');
    this.ingestionStateTableName = this.configService.get('DYNAMODB_INGESTION_STATE_TABLE', 'tiktok-commerce-dev-ingestion-state');
    this.newVideoPostedTopicArn = this.configService.get('SNS_NEW_VIDEO_POSTED_TOPIC_ARN', '');
  }

  /**
   * Main ingestion job - processes all active sellers
   */
  async runIngestionJob(): Promise<{ processed: number; errors: number; skipped: number }> {
    const startTime = Date.now();
    this.logger.log('Starting scheduled ingestion job');

    let processed = 0;
    let errors = 0;
    let skipped = 0;
    let totalVideosFound = 0;
    let totalEventsEmitted = 0;

    try {
      // Log job start
      this.monitoringService.logIngestionEvent('job_started', {
        timestamp: new Date().toISOString(),
      });

      // Get all active shops
      const shops = await this.getAllActiveShops();
      this.logger.log(`Found ${shops.length} active shops to process`);

      // Check if we have enough Apify credits
      const usageStats = this.apifyService.getUsageStats();
      this.logger.log(`Apify usage: ${usageStats.dailyUsage}/${usageStats.remainingComputeUnits + usageStats.dailyUsage} CU`);

      // Process shops sequentially to avoid rate limits
      for (const shop of shops) {
        try {
          // Check if we can make another API call
          if (!this.apifyService.canMakeApiCall()) {
            this.logger.warn(`Skipping ${shop.handle} - daily Apify limit reached`);
            skipped++;

            await this.monitoringService.sendErrorMetrics({
              errorType: 'ApifyLimitReached',
              shopHandle: shop.handle,
              errorMessage: 'Daily Apify usage limit reached',
              timestamp: new Date().toISOString(),
            });

            continue;
          }

          const result = await this.processShop(shop);
          if (result.success) {
            processed++;
            totalVideosFound += result.videosFound;
            totalEventsEmitted += result.newVideos;
          } else {
            errors++;
          }

          // Add delay between shops to be respectful to Apify
          await this.delay(2000); // 2 second delay

        } catch (error) {
          this.logger.error(`Failed to process shop: ${shop.handle}`, error);
          errors++;

          await this.monitoringService.sendErrorMetrics({
            errorType: 'ShopProcessingError',
            shopHandle: shop.handle,
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const duration = Date.now() - startTime;
      const finalUsageStats = this.apifyService.getUsageStats();

      // Send metrics to CloudWatch
      const metrics: IngestionMetrics = {
        shopsProcessed: processed,
        videosFound: totalVideosFound,
        newVideosProcessed: totalEventsEmitted,
        eventsEmitted: totalEventsEmitted,
        errors,
        apifyUsage: finalUsageStats.dailyUsage,
        duration,
      };

      await this.monitoringService.sendIngestionMetrics(metrics);

      // Log job completion
      this.monitoringService.logIngestionEvent('job_completed', {
        processed,
        errors,
        skipped,
        totalVideosFound,
        totalEventsEmitted,
        duration: `${duration}ms`,
        apifyUsage: finalUsageStats.dailyUsage,
      });

      this.logger.log(`Ingestion job completed: ${processed} processed, ${errors} errors, ${skipped} skipped`);

      return { processed, errors, skipped };

    } catch (error) {
      const duration = Date.now() - startTime;

      await this.monitoringService.sendErrorMetrics({
        errorType: 'JobFailure',
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
      });

      this.monitoringService.logIngestionEvent('job_failed', {
        error: error.message,
        duration: `${duration}ms`,
      }, 'error');

      this.logger.error('Ingestion job failed', error);
      throw error;
    }
  }

  /**
   * Process a single shop
   */
  async processShop(shop: Shop): Promise<{ success: boolean; videosFound: number; newVideos: number }> {
    const handle = shop.handle;
    this.logger.log(`Processing shop: ${handle}`);

    try {
      // Update ingestion state to running
      await this.updateIngestionState(handle, 'running');

      // Get last processed video IDs to avoid duplicates
      const lastState = await this.getIngestionState(handle);
      const lastVideoIds = lastState?.last_video_ids || [];

      // Extract videos from TikTok using Apify
      const extractionResult = await this.apifyService.extractVideos(handle, 50); // Get up to 50 recent videos
      
      // Filter for videos with #TRACK
      const trackedVideos = this.apifyService.filterTrackedVideos(extractionResult.videos);
      this.logger.log(`Found ${trackedVideos.length} videos with #TRACK for ${handle}`);

      // Filter out already processed videos
      const newVideos = trackedVideos.filter(video => !lastVideoIds.includes(video.id));
      this.logger.log(`Found ${newVideos.length} new videos for ${handle}`);

      let eventsEmitted = 0;

      // Process each new video
      for (const video of newVideos) {
        try {
          // Check if video already exists in Products table
          const exists = await this.videoExistsInProducts(handle, video.id);
          if (exists) {
            this.logger.log(`Video ${video.id} already exists in products table, skipping`);
            continue;
          }

          // Emit new-video-posted event
          await this.emitVideoPostedEvent(handle, video);
          eventsEmitted++;
          
        } catch (error) {
          this.logger.error(`Failed to process video ${video.id} for ${handle}`, error);
        }
      }

      // Update ingestion state with success
      await this.updateIngestionState(handle, 'completed', {
        last_video_ids: trackedVideos.map(v => v.id).slice(0, 10), // Keep last 10 video IDs
        videos_processed: eventsEmitted,
      });

      this.logger.log(`Successfully processed ${handle}: ${eventsEmitted} events emitted`);
      
      return {
        success: true,
        videosFound: trackedVideos.length,
        newVideos: eventsEmitted,
      };

    } catch (error) {
      // Update ingestion state with failure
      await this.updateIngestionState(handle, 'failed', {
        errors: [error.message],
      });
      
      this.logger.error(`Failed to process shop: ${handle}`, error);
      return {
        success: false,
        videosFound: 0,
        newVideos: 0,
      };
    }
  }

  private async getAllActiveShops(): Promise<Shop[]> {
    try {
      const result = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.shopsTableName,
          FilterExpression: 'subscription_status IN (:trial, :paid)',
          ExpressionAttributeValues: marshall({
            ':trial': 'trial',
            ':paid': 'paid',
          }),
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => unmarshall(item) as Shop);
    } catch (error) {
      this.logger.error('Failed to get active shops', error);
      throw error;
    }
  }

  private async videoExistsInProducts(sellerHandle: string, videoId: string): Promise<boolean> {
    try {
      const result = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.productsTableName,
          Key: marshall({
            seller_handle: sellerHandle,
            video_id: videoId,
          }),
        })
      );

      return !!result.Item;
    } catch (error) {
      this.logger.error(`Failed to check if video exists: ${sellerHandle}/${videoId}`, error);
      return false; // Assume it doesn't exist on error to avoid skipping
    }
  }

  private async emitVideoPostedEvent(sellerHandle: string, video: TikTokVideo): Promise<void> {
    const event: VideoPostedEvent = {
      video_id: video.id,
      caption: video.text,
      seller_handle: sellerHandle,
      video_url: video.webVideoUrl,
      timestamp: new Date().toISOString(),
      metadata: {
        likes_count: video.stats?.diggCount,
        comments_count: video.stats?.commentCount,
        shares_count: video.stats?.shareCount,
        duration: undefined, // Not available in current API response
        thumbnail_url: undefined, // Not downloading thumbnails to save costs
      },
    };

    try {
      await this.snsClient.send(
        new PublishCommand({
          TopicArn: this.newVideoPostedTopicArn,
          Message: JSON.stringify(event),
          Subject: 'New TikTok Video Posted',
          MessageAttributes: {
            eventType: {
              DataType: 'String',
              StringValue: 'VideoPosted',
            },
            sellerHandle: {
              DataType: 'String',
              StringValue: sellerHandle,
            },
            videoId: {
              DataType: 'String',
              StringValue: video.id,
            },
          },
        })
      );

      this.logger.log(`Emitted new-video-posted event for ${sellerHandle}/${video.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit event for ${sellerHandle}/${video.id}`, error);
      throw error;
    }
  }

  private async getIngestionState(handle: string): Promise<IngestionState | null> {
    try {
      const result = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.ingestionStateTableName,
          Key: marshall({ handle }),
        })
      );

      if (!result.Item) {
        return null;
      }

      return unmarshall(result.Item) as IngestionState;
    } catch (error) {
      this.logger.error(`Failed to get ingestion state for ${handle}`, error);
      return null;
    }
  }

  private async updateIngestionState(
    handle: string,
    status: 'running' | 'completed' | 'failed',
    additionalData: Partial<IngestionState> = {}
  ): Promise<void> {
    const now = new Date().toISOString();
    
    const state: IngestionState = {
      handle,
      last_run: now,
      status,
      videos_processed: 0,
      last_video_ids: [],
      ...additionalData,
    };

    try {
      await this.dynamoClient.send(
        new PutItemCommand({
          TableName: this.ingestionStateTableName,
          Item: marshall(state),
        })
      );
    } catch (error) {
      this.logger.error(`Failed to update ingestion state for ${handle}`, error);
      // Don't throw here as this is not critical for the main flow
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
