import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { VideoService } from './video.service';
import { S3Service } from './s3.service';
import {
  VideoPostedEvent,
  ThumbnailGeneratedEvent,
  WorkerConfig,
  ProcessingResult,
  ThumbnailInfo
} from '../types';

// Simple logger implementation
class Logger {
  constructor(private context: string) {}

  info(message: string, meta?: any) {
    console.log(`[${this.context}] INFO: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  error(message: string, meta?: any) {
    console.error(`[${this.context}] ERROR: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  warn(message: string, meta?: any) {
    console.warn(`[${this.context}] WARN: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  debug(message: string, meta?: any) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[${this.context}] DEBUG: ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
}

export class ThumbnailGeneratorWorker {
  private sqsClient: SQSClient;
  private snsClient: SNSClient;
  private videoService: VideoService;
  private s3Service: S3Service;
  private logger = new Logger('ThumbnailGeneratorWorker');
  private config: WorkerConfig;
  private isRunning = false;
  private processedCount = 0;
  private errorCount = 0;

  constructor(config: WorkerConfig) {
    this.config = config;
    
    // Initialize AWS clients
    this.sqsClient = new SQSClient({ 
      region: config.awsRegion,
      maxAttempts: 3
    });
    
    this.snsClient = new SNSClient({ 
      region: config.awsRegion,
      maxAttempts: 3
    });

    // Initialize services
    this.videoService = new VideoService(config);
    this.s3Service = new S3Service(config.s3BucketName, config.awsRegion);

    this.logger.info('Thumbnail Generator Worker initialized', {
      s3Bucket: config.s3BucketName,
      queueUrl: config.sqsQueueUrl,
      maxVideoSize: `${config.maxVideoSizeMB}MB`,
      maxDuration: `${config.maxVideoDurationSeconds}s`
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting Thumbnail Generator Worker');

    while (this.isRunning) {
      try {
        await this.pollAndProcessMessages();
        
        // Brief pause between polling cycles
        await this.sleep(2000);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Error in main worker loop', { error: errorMessage });
        await this.sleep(10000); // Longer pause on error
      }
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Thumbnail Generator Worker');
    this.isRunning = false;
  }

  getStats() {
    return {
      processed: this.processedCount,
      errors: this.errorCount,
      isRunning: this.isRunning
    };
  }

  private async pollAndProcessMessages(): Promise<void> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.config.sqsQueueUrl,
      MaxNumberOfMessages: this.config.batchSize,
      WaitTimeSeconds: this.config.waitTimeSeconds,
      VisibilityTimeout: this.config.visibilityTimeout,
      MessageAttributeNames: ['All']
    });

    try {
      const response = await this.sqsClient.send(command);
      
      if (!response.Messages || response.Messages.length === 0) {
        this.logger.debug('No messages received from SQS');
        return;
      }

      this.logger.info(`Received ${response.Messages.length} messages from SQS`);

      // Process messages sequentially for thumbnail generation (resource intensive)
      for (const message of response.Messages) {
        try {
          await this.processMessage(message);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error('Failed to process message', {
            messageId: message.MessageId,
            error: errorMessage
          });
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to poll SQS messages', { error: errorMessage });
      throw error;
    }
  }

  private async processMessage(message: any): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      if (!message.Body) {
        throw new Error('Message body is empty');
      }

      // Parse the video posted event
      const videoEvent: VideoPostedEvent = JSON.parse(message.Body);
      
      this.logger.info('Processing video for thumbnail generation', {
        videoId: videoEvent.video_id,
        sellerHandle: videoEvent.seller_handle,
        videoUrl: videoEvent.video_url
      });

      // Validate required fields
      if (!videoEvent.video_id || !videoEvent.video_url || !videoEvent.seller_handle) {
        throw new Error('Missing required fields in video event');
      }

      // Check if thumbnails already exist
      const thumbnailExists = await this.s3Service.checkThumbnailExists(
        videoEvent.seller_handle,
        videoEvent.video_id
      );

      if (thumbnailExists) {
        this.logger.info('Thumbnails already exist, skipping processing', {
          videoId: videoEvent.video_id,
          sellerHandle: videoEvent.seller_handle
        });

        // Create mock thumbnails for existing case
        const existingThumbnails: ThumbnailInfo[] = [];
        for (let i = 0; i < this.config.thumbnailsToGenerate; i++) {
          const thumbnailUrl = this.s3Service.generateThumbnailUrl(
            videoEvent.seller_handle,
            videoEvent.video_id
          );

          existingThumbnails.push({
            thumbnail_url: thumbnailUrl,
            thumbnail_s3_key: `thumbnails/${videoEvent.seller_handle}/${videoEvent.video_id}_${i}.jpg`,
            frame_timestamp: i * 5, // Mock timestamps
            frame_index: i,
            confidence_score: 0.8,
            quality_score: 0.8,
            is_primary: i === 0
          });
        }

        await this.emitThumbnailGeneratedEvent({
          video_id: videoEvent.video_id,
          seller_handle: videoEvent.seller_handle,
          thumbnails: existingThumbnails,
          primary_thumbnail: existingThumbnails[0],
          processing_metadata: {
            video_duration: 30,
            frames_analyzed: 0,
            thumbnails_generated: existingThumbnails.length,
            processing_time_ms: Date.now() - startTime
          },
          timestamp: new Date().toISOString()
        });

        await this.deleteMessage(message);
        this.processedCount++;

        return {
          success: true,
          messageId: message.MessageId,
          videoId: videoEvent.video_id,
          processingTime: Date.now() - startTime,
          thumbnailUrl: existingThumbnails[0].thumbnail_url
        };
      }

      // Process video to generate multiple thumbnails
      const processingResult = await this.videoService.processVideo(
        videoEvent.video_url,
        videoEvent.video_id
      );

      if (!processingResult.success || processingResult.thumbnails.length === 0) {
        throw new Error(processingResult.error || 'Video processing failed');
      }

      // Upload all thumbnails to S3
      const thumbnailPaths = processingResult.thumbnails.map(t => t.thumbnail_path);
      const uploadResults = await this.s3Service.uploadMultipleThumbnails(
        thumbnailPaths,
        videoEvent.seller_handle,
        videoEvent.video_id
      );

      const failedUploads = uploadResults.filter(r => !r.success);
      if (failedUploads.length === uploadResults.length) {
        throw new Error('All S3 uploads failed');
      }

      // Create thumbnail info array
      const thumbnails: ThumbnailInfo[] = [];
      for (let i = 0; i < processingResult.thumbnails.length; i++) {
        const thumbnail = processingResult.thumbnails[i];
        const uploadResult = uploadResults[i];

        if (uploadResult.success) {
          thumbnails.push({
            thumbnail_url: uploadResult.s3Url,
            thumbnail_s3_key: uploadResult.s3Key,
            frame_timestamp: thumbnail.frame_analysis.timestamp,
            frame_index: thumbnail.frame_analysis.frame_index,
            confidence_score: thumbnail.frame_analysis.quality_score,
            quality_score: thumbnail.frame_analysis.quality_score,
            detected_objects: thumbnail.frame_analysis.detected_objects,
            is_primary: i === 0 // First thumbnail is primary
          });
        }
      }

      if (thumbnails.length === 0) {
        throw new Error('No thumbnails were successfully uploaded');
      }

      // Primary thumbnail is the first one (highest quality)
      const primaryThumbnail = thumbnails[0];

      // Create thumbnail generated event
      const thumbnailEvent: ThumbnailGeneratedEvent = {
        video_id: videoEvent.video_id,
        seller_handle: videoEvent.seller_handle,
        thumbnails,
        primary_thumbnail: primaryThumbnail,
        processing_metadata: {
          video_duration: processingResult.video_duration,
          frames_analyzed: processingResult.frames_analyzed,
          thumbnails_generated: thumbnails.length,
          processing_time_ms: processingResult.processing_time
        },
        timestamp: new Date().toISOString()
      };

      // Publish to SNS
      await this.emitThumbnailGeneratedEvent(thumbnailEvent);

      // Delete message from SQS
      await this.deleteMessage(message);

      const totalProcessingTime = Date.now() - startTime;
      this.processedCount++;

      this.logger.info('Successfully generated thumbnails', {
        videoId: videoEvent.video_id,
        thumbnailsGenerated: thumbnails.length,
        primaryThumbnailUrl: primaryThumbnail.thumbnail_url,
        framesAnalyzed: processingResult.frames_analyzed,
        processingTime: `${totalProcessingTime}ms`,
        avgConfidence: thumbnails.reduce((sum, t) => sum + t.confidence_score, 0) / thumbnails.length
      });

      return {
        success: true,
        messageId: message.MessageId,
        videoId: videoEvent.video_id,
        processingTime: totalProcessingTime,
        thumbnailUrl: primaryThumbnail.thumbnail_url
      };

    } catch (error) {
      this.errorCount++;
      const processingTime = Date.now() - startTime;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to process message', {
        messageId: message.MessageId,
        error: errorMessage,
        processingTime: `${processingTime}ms`
      });

      // Don't delete message on error - let it retry or go to DLQ
      return {
        success: false,
        messageId: message.MessageId,
        error: errorMessage,
        processingTime
      };
    }
  }

  private async emitThumbnailGeneratedEvent(event: ThumbnailGeneratedEvent): Promise<void> {
    const command = new PublishCommand({
      TopicArn: this.config.snsTopicArn,
      Message: JSON.stringify(event),
      Subject: 'Thumbnail Generated',
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: 'ThumbnailGenerated'
        },
        videoId: {
          DataType: 'String',
          StringValue: event.video_id
        },
        sellerHandle: {
          DataType: 'String',
          StringValue: event.seller_handle
        },
        thumbnailsCount: {
          DataType: 'Number',
          StringValue: event.thumbnails.length.toString()
        },
        primaryConfidenceScore: {
          DataType: 'Number',
          StringValue: event.primary_thumbnail.confidence_score.toString()
        }
      }
    });

    try {
      await this.snsClient.send(command);
      this.logger.debug('Published thumbnail generated event to SNS', {
        videoId: event.video_id,
        topicArn: this.config.snsTopicArn
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to publish to SNS', { error: errorMessage });
      throw error;
    }
  }

  private async deleteMessage(message: any): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.config.sqsQueueUrl,
      ReceiptHandle: message.ReceiptHandle
    });

    try {
      await this.sqsClient.send(command);
      this.logger.debug('Deleted message from SQS', { messageId: message.MessageId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to delete message from SQS', {
        messageId: message.MessageId,
        error: errorMessage
      });
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
