import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { LLMService } from './llm.service';
import {
  VideoPostedEvent,
  CaptionParsedEvent,
  WorkerConfig,
  ProcessingResult
} from '../types';

// Simple logger implementation
class Logger {
  constructor(private context: string) {}

  info(message: string, meta?: Record<string, unknown>) {
    console.log(`[${this.context}] INFO: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(`[${this.context}] ERROR: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[${this.context}] WARN: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[${this.context}] DEBUG: ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
}

export class CaptionParserWorker {
  private sqsClient: SQSClient;
  private snsClient: SNSClient;
  private llmService: LLMService;
  private logger = new Logger('CaptionParserWorker');
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

    // Initialize LLM service
    this.llmService = new LLMService(
      config.llmProvider,
      config.llmModel,
      config.llmApiKey,
      config.ollamaBaseUrl
    );

    this.logger.info('Caption Parser Worker initialized', {
      provider: config.llmProvider,
      model: config.llmModel,
      queueUrl: config.sqsQueueUrl
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting Caption Parser Worker');

    while (this.isRunning) {
      try {
        await this.pollAndProcessMessages();
        
        // Brief pause between polling cycles
        await this.sleep(1000);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Error in main worker loop', { error: errorMessage });
        await this.sleep(5000); // Longer pause on error
      }
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Caption Parser Worker');
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
      const successful = results.filter((r: PromiseSettledResult<ProcessingResult>) => r.status === 'fulfilled').length;
      const failed = results.filter((r: PromiseSettledResult<ProcessingResult>) => r.status === 'rejected').length;
      
      this.logger.info(`Batch processing complete: ${successful} successful, ${failed} failed`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to poll SQS messages', { error: errorMessage });
      throw error;
    }
  }

  private async processMessage(message: { Body?: string; ReceiptHandle: string; MessageId?: string }): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      if (!message.Body) {
        throw new Error('Message body is empty');
      }

      // Parse the video posted event
      const videoEvent: VideoPostedEvent = JSON.parse(message.Body);
      
      this.logger.info('Processing video caption', {
        videoId: videoEvent.video_id,
        sellerHandle: videoEvent.seller_handle,
        captionLength: videoEvent.caption?.length || 0
      });

      // Validate required fields
      if (!videoEvent.video_id || !videoEvent.caption || !videoEvent.seller_handle) {
        throw new Error('Missing required fields in video event');
      }

      // Parse caption using LLM
      const parsedData = await this.llmService.parseCaptionWithLLM(videoEvent.caption);
      
      // Create caption parsed event
      const captionParsedEvent: CaptionParsedEvent = {
        video_id: videoEvent.video_id,
        seller_handle: videoEvent.seller_handle,
        title: parsedData.title,
        price: parsedData.price,
        sizes: parsedData.sizes,
        tags: parsedData.tags,
        confidence_score: parsedData.confidence_score,
        raw_caption: videoEvent.caption,
        timestamp: new Date().toISOString()
      };

      // Publish to SNS
      await this.publishCaptionParsedEvent(captionParsedEvent);

      // Delete message from SQS
      await this.deleteMessage(message);

      const processingTime = Date.now() - startTime;
      this.processedCount++;

      this.logger.info('Successfully processed caption', {
        videoId: videoEvent.video_id,
        title: parsedData.title,
        price: parsedData.price,
        tagsCount: parsedData.tags.length,
        processingTime: `${processingTime}ms`,
        confidence: parsedData.confidence_score
      });

      return {
        success: true,
        messageId: message.MessageId || 'unknown',
        videoId: videoEvent.video_id,
        processingTime
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
        messageId: message.MessageId || 'unknown',
        error: errorMessage,
        processingTime
      };
    }
  }

  private async publishCaptionParsedEvent(event: CaptionParsedEvent): Promise<void> {
    const command = new PublishCommand({
      TopicArn: this.config.snsTopicArn,
      Message: JSON.stringify(event),
      Subject: 'Caption Parsed',
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: 'CaptionParsed'
        },
        videoId: {
          DataType: 'String',
          StringValue: event.video_id
        },
        sellerHandle: {
          DataType: 'String',
          StringValue: event.seller_handle
        },
        hasPrice: {
          DataType: 'String',
          StringValue: event.price !== null ? 'true' : 'false'
        }
      }
    });

    try {
      await this.snsClient.send(command);
      this.logger.debug('Published caption parsed event to SNS', {
        videoId: event.video_id,
        topicArn: this.config.snsTopicArn
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to publish to SNS', { error: errorMessage });
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
