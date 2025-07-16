import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { createLogger, format, transports } from 'winston';
import { TaggingService } from './tagging.service';
import { 
  VideoPostedEvent, 
  TagsGeneratedEvent, 
  SQSMessage, 
  WorkerConfig, 
  ProcessingResult 
} from '../types';

class Logger {
  private logger;

  constructor(private context: string) {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        })
      ]
    });
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.logger.info(`[${this.context}] ${message}`, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.logger.error(`[${this.context}] ${message}`, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(`[${this.context}] ${message}`, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.logger.debug(`[${this.context}] ${message}`, meta);
  }
}

export class AutoTaggerWorker {
  private sqsClient: SQSClient;
  private snsClient: SNSClient;
  private taggingService: TaggingService;
  private logger = new Logger('AutoTaggerWorker');
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

    // Initialize tagging service
    this.taggingService = new TaggingService(
      config.llmProvider,
      config.llmModel,
      config.taggingConfig,
      config.llmApiKey,
      config.ollamaBaseUrl
    );

    this.logger.info('Auto-Tagger Worker initialized', {
      provider: config.llmProvider,
      model: config.llmModel,
      queueUrl: config.sqsQueueUrl,
      maxTags: config.taggingConfig.maxTags
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting Auto-Tagger Worker');

    while (this.isRunning) {
      try {
        await this.pollAndProcessMessages();
        
        // Brief pause between polling cycles
        await this.sleep(1000);
        
      } catch (error) {
        this.logger.error('Error in main worker loop', { error: error.message });
        await this.sleep(5000); // Longer pause on error
      }
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Auto-Tagger Worker');
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

      // Process messages in parallel
      const processingPromises = response.Messages.map((message: any) =>
        this.processMessage(message)
      );

      const results = await Promise.allSettled(processingPromises);
      
      // Log results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      this.logger.info(`Batch processing complete: ${successful} successful, ${failed} failed`);
      
    } catch (error) {
      this.logger.error('Failed to poll SQS messages', { error: error.message });
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
      
      this.logger.info('Processing video for auto-tagging', {
        videoId: videoEvent.video_id,
        sellerHandle: videoEvent.seller_handle,
        captionLength: videoEvent.caption?.length || 0
      });

      // Validate required fields
      if (!videoEvent.video_id || !videoEvent.caption || !videoEvent.seller_handle) {
        throw new Error('Missing required fields in video event');
      }

      // Extract existing tags from caption (hashtags)
      const existingTags = this.extractHashtags(videoEvent.caption);
      
      // Generate semantic tags
      const analysisResult = await this.taggingService.generateSemanticTags(
        videoEvent.caption,
        existingTags,
        videoEvent.metadata?.thumbnail_url
      );

      // Filter tags by confidence threshold
      const filteredSemanticTags = analysisResult.semantic_tags.filter(tag => 
        (analysisResult.confidence_scores[tag] || 0) >= this.config.taggingConfig.minConfidence
      );

      // Create tags generated event
      const tagsEvent: TagsGeneratedEvent = {
        video_id: videoEvent.video_id,
        seller_handle: videoEvent.seller_handle,
        extra_tags: filteredSemanticTags,
        semantic_tags: analysisResult.semantic_tags,
        category_tags: analysisResult.category_tags,
        confidence_scores: analysisResult.confidence_scores,
        tagging_metadata: {
          caption_analyzed: true,
          thumbnail_analyzed: !!videoEvent.metadata?.thumbnail_url,
          llm_provider: this.config.llmProvider,
          processing_time_ms: Date.now() - startTime,
          total_tags_generated: filteredSemanticTags.length + analysisResult.category_tags.length
        },
        timestamp: new Date().toISOString()
      };

      // Publish to SNS
      await this.publishTagsGeneratedEvent(tagsEvent);

      // Delete message from SQS
      await this.deleteMessage(message);

      const processingTime = Date.now() - startTime;
      this.processedCount++;

      this.logger.info('Successfully processed auto-tagging', {
        videoId: videoEvent.video_id,
        semanticTagsCount: filteredSemanticTags.length,
        categoryTagsCount: analysisResult.category_tags.length,
        processingTime: `${processingTime}ms`,
        avgConfidence: this.calculateAverageConfidence(analysisResult.confidence_scores)
      });

      return {
        success: true,
        messageId: message.MessageId,
        videoId: videoEvent.video_id,
        processingTime,
        tagsGenerated: filteredSemanticTags.length + analysisResult.category_tags.length
      };

    } catch (error) {
      this.errorCount++;
      const processingTime = Date.now() - startTime;
      
      this.logger.error('Failed to process message', {
        messageId: message.MessageId,
        error: error.message,
        processingTime: `${processingTime}ms`
      });

      // Don't delete message on error - let it retry or go to DLQ
      return {
        success: false,
        messageId: message.MessageId,
        error: error.message,
        processingTime
      };
    }
  }

  private extractHashtags(caption: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const hashtags: string[] = [];
    let match;
    
    while ((match = hashtagRegex.exec(caption)) !== null) {
      const tag = match[1].toLowerCase();
      if (tag !== 'track' && tag.length > 2) {
        hashtags.push(tag);
      }
    }
    
    return hashtags;
  }

  private calculateAverageConfidence(scores: Record<string, number>): number {
    const values = Object.values(scores);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private async publishTagsGeneratedEvent(event: TagsGeneratedEvent): Promise<void> {
    const command = new PublishCommand({
      TopicArn: this.config.snsTopicArn,
      Message: JSON.stringify(event),
      Subject: 'Tags Generated',
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: 'TagsGenerated'
        },
        videoId: {
          DataType: 'String',
          StringValue: event.video_id
        },
        sellerHandle: {
          DataType: 'String',
          StringValue: event.seller_handle
        },
        tagsCount: {
          DataType: 'Number',
          StringValue: event.extra_tags.length.toString()
        }
      }
    });

    try {
      await this.snsClient.send(command);
      this.logger.debug('Published tags generated event to SNS', {
        videoId: event.video_id,
        topicArn: this.config.snsTopicArn
      });
    } catch (error) {
      this.logger.error('Failed to publish to SNS', { error: error.message });
      throw error;
    }
  }

  private async deleteMessage(message: { ReceiptHandle: string; MessageId?: string }): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.config.sqsQueueUrl,
      ReceiptHandle: message.ReceiptHandle
    });

    try {
      await this.sqsClient.send(command);
      this.logger.debug('Deleted message from SQS', { messageId: message.MessageId });
    } catch (error) {
      this.logger.error('Failed to delete message from SQS', { 
        messageId: message.MessageId,
        error: error.message 
      });
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
