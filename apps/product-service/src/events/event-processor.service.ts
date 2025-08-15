import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBService } from '../database/dynamodb.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import {
  CaptionParsedEvent,
  ThumbnailGeneratedEvent,
  ProductAssemblyData,
  AssembledProduct,
  NewProductEvent,
  SQSMessage,
  EventProcessingResult,
} from './types';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);
  private readonly sqsClient: SQSClient;
  private readonly snsClient: SNSClient;
  private readonly productAssemblyQueueUrl: string;
  private readonly newProductTopicArn: string;
  private isProcessing = false;

  constructor(
    private configService: ConfigService,
    private dynamoDBService: DynamoDBService,
    private webSocketGateway: WebSocketGateway,
  ) {
    this.sqsClient = new SQSClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    });
    
    this.snsClient = new SNSClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    });

    this.productAssemblyQueueUrl = this.configService.get('SQS_QUEUE_URL', '');
    this.newProductTopicArn = this.configService.get('SNS_TOPIC_ARN', '');
  }

  /**
   * Start processing events from the product assembly queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Event processing already started');
      return;
    }

    this.isProcessing = true;
    this.logger.log('Starting event processing for product assembly queue');

    // Start processing the unified product assembly queue
    this.processProductAssemblyQueue().catch((error) => {
      this.logger.error('Error in event processing', { error: error.message });
      this.isProcessing = false;
    });
  }

  /**
   * Stop processing events
   */
  stopProcessing(): void {
    this.isProcessing = false;
    this.logger.log('Stopped event processing');
  }

  /**
   * Process events from the unified product assembly queue
   */
  private async processProductAssemblyQueue(): Promise<void> {
    while (this.isProcessing) {
      try {
        const messages = await this.receiveMessages(this.productAssemblyQueueUrl);

        if (messages.length === 0) {
          await this.sleep(5000); // Wait 5 seconds before polling again
          continue;
        }

        this.logger.debug(`Processing ${messages.length} product assembly messages`);

        for (const message of messages) {
          try {
            await this.processMessage(message);
            await this.deleteMessage(this.productAssemblyQueueUrl, message);
          } catch (error) {
            this.logger.error('Failed to process product assembly message', {
              messageId: message.MessageId,
              error: error.message,
            });
          }
        }
      } catch (error) {
        this.logger.error('Error in product assembly queue processing', { error: error.message });
        await this.sleep(10000); // Wait longer on error
      }
    }
  }

  /**
   * Process a single message and route to appropriate handler based on event type
   */
  private async processMessage(message: SQSMessage): Promise<EventProcessingResult> {
    try {
      // Parse SNS notification to get message attributes and content
      const snsNotification = JSON.parse(message.Body);

      // Check if it's an SNS notification
      if (snsNotification.Type === 'Notification' && snsNotification.MessageAttributes) {
        const eventType = snsNotification.MessageAttributes?.eventType?.Value;

        this.logger.debug('Processing message with event type', {
          eventType,
          messageId: message.MessageId
        });

        // Route to appropriate handler based on event type
        switch (eventType) {
          case 'CaptionParsed':
            return await this.processCaptionMessage(message);
          case 'ThumbnailGenerated':
            return await this.processThumbnailMessage(message);
          case 'VideoPosted':
            // Skip VideoPosted events - they're for AI workers, not product assembly
            this.logger.debug('Skipping VideoPosted event in product assembly queue');
            return {
              success: true,
              message_id: message.MessageId,
              event_type: 'video_posted_skipped',
              processing_time_ms: 0
            };
          default:
            this.logger.warn(`Unknown event type: ${eventType}, attempting content-based detection`);
            // Fall through to content-based detection
        }
      } else {
        // Fallback: try to detect event type from message content
        const messageContent = snsNotification.Message ? JSON.parse(snsNotification.Message) : snsNotification;

        if (messageContent.title !== undefined && messageContent.raw_caption !== undefined) {
          // Looks like a caption parsed event
          return await this.processCaptionMessage(message);
        } else if (messageContent.thumbnails && Array.isArray(messageContent.thumbnails)) {
          // Looks like a thumbnail generated event
          return await this.processThumbnailMessage(message);
        } else {
          throw new Error('Unable to determine event type from message content');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to process message', {
        messageId: message.MessageId,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Process a single caption parsed message
   */
  private async processCaptionMessage(message: SQSMessage): Promise<EventProcessingResult> {
    const startTime = Date.now();

    try {
      const captionEvent: CaptionParsedEvent = this.parseEventFromSNS(message.Body, 'CaptionParsedEvent');
      
      this.logger.debug('Processing caption event', {
        videoId: captionEvent.video_id,
        sellerHandle: captionEvent.seller_handle,
        title: captionEvent.title,
      });

      // Get or create assembly data
      let assemblyData = await this.dynamoDBService.getProductAssemblyData(
        captionEvent.video_id,
        captionEvent.seller_handle
      );

      if (!assemblyData) {
        assemblyData = this.createNewAssemblyData(captionEvent.video_id, captionEvent.seller_handle);
      }

      // Add caption data
      assemblyData.caption_data = captionEvent;
      assemblyData.updated_at = new Date().toISOString();
      assemblyData.is_complete = !!(assemblyData.caption_data && assemblyData.thumbnail_data);

      // Save assembly data
      await this.dynamoDBService.saveProductAssemblyData(assemblyData);

      // If complete, assemble and save product
      if (assemblyData.is_complete) {
        await this.assembleAndSaveProduct(assemblyData);
      }

      return {
        success: true,
        message_id: message.MessageId,
        video_id: captionEvent.video_id,
        seller_handle: captionEvent.seller_handle,
        event_type: 'caption_parsed',
        processing_time_ms: Date.now() - startTime,
        product_assembled: assemblyData.is_complete,
      };
    } catch (error) {
      this.logger.error('Failed to process caption message', {
        messageId: message.MessageId,
        error: error.message,
      });
      
      return {
        success: false,
        message_id: message.MessageId,
        error: error.message,
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Process a single thumbnail generated message
   */
  private async processThumbnailMessage(message: SQSMessage): Promise<EventProcessingResult> {
    const startTime = Date.now();

    try {
      const thumbnailEvent: ThumbnailGeneratedEvent = this.parseEventFromSNS(message.Body, 'ThumbnailGeneratedEvent');
      
      this.logger.debug('Processing thumbnail event', {
        videoId: thumbnailEvent.video_id,
        sellerHandle: thumbnailEvent.seller_handle,
        thumbnailsCount: thumbnailEvent.thumbnails.length,
      });

      // Get or create assembly data
      let assemblyData = await this.dynamoDBService.getProductAssemblyData(
        thumbnailEvent.video_id,
        thumbnailEvent.seller_handle
      );

      if (!assemblyData) {
        assemblyData = this.createNewAssemblyData(thumbnailEvent.video_id, thumbnailEvent.seller_handle);
      }

      // Add thumbnail data
      assemblyData.thumbnail_data = thumbnailEvent;
      assemblyData.updated_at = new Date().toISOString();
      assemblyData.is_complete = !!(assemblyData.caption_data && assemblyData.thumbnail_data);

      // Save assembly data
      await this.dynamoDBService.saveProductAssemblyData(assemblyData);

      // If complete, assemble and save product
      if (assemblyData.is_complete) {
        await this.assembleAndSaveProduct(assemblyData);
      }

      return {
        success: true,
        message_id: message.MessageId,
        video_id: thumbnailEvent.video_id,
        seller_handle: thumbnailEvent.seller_handle,
        event_type: 'thumbnail_generated',
        processing_time_ms: Date.now() - startTime,
        product_assembled: assemblyData.is_complete,
      };
    } catch (error) {
      this.logger.error('Failed to process thumbnail message', {
        messageId: message.MessageId,
        error: error.message,
      });
      
      return {
        success: false,
        message_id: message.MessageId,
        error: error.message,
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Create new assembly data structure
   */
  private createNewAssemblyData(videoId: string, sellerHandle: string): ProductAssemblyData {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now

    return {
      video_id: videoId,
      seller_handle: sellerHandle,
      created_at: now,
      updated_at: now,
      ttl,
      is_complete: false,
    };
  }

  /**
   * Assemble complete product and save to products table
   */
  private async assembleAndSaveProduct(assemblyData: ProductAssemblyData): Promise<void> {
    if (!assemblyData.caption_data || !assemblyData.thumbnail_data) {
      throw new Error('Cannot assemble product: missing caption or thumbnail data');
    }

    const product: AssembledProduct = {
      seller_handle: assemblyData.seller_handle,
      video_id: assemblyData.video_id,
      title: assemblyData.caption_data.title,
      price: assemblyData.caption_data.price,
      sizes: assemblyData.caption_data.sizes,
      tags: assemblyData.caption_data.tags,
      thumbnails: assemblyData.thumbnail_data.thumbnails,
      primary_thumbnail: assemblyData.thumbnail_data.primary_thumbnail,
      confidence_score: assemblyData.caption_data.confidence_score,
      raw_caption: assemblyData.caption_data.raw_caption,
      processing_metadata: assemblyData.thumbnail_data.processing_metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to products table
    await this.dynamoDBService.saveProduct(product);

    // Clean up staging data
    await this.dynamoDBService.deleteProductAssemblyData(
      assemblyData.video_id,
      assemblyData.seller_handle
    );

    // Notify frontend via WebSocket
    await this.notifyNewProduct(product);

    this.logger.log('Successfully assembled and saved product', {
      videoId: product.video_id,
      sellerHandle: product.seller_handle,
      title: product.title,
      price: product.price,
    });
  }

  /**
   * Notify frontend about new product via WebSocket and SNS
   */
  private async notifyNewProduct(product: AssembledProduct): Promise<void> {
    const newProductEvent: NewProductEvent = {
      event_type: 'new_product',
      product,
      timestamp: new Date().toISOString(),
    };

    // Send via WebSocket for real-time updates
    this.webSocketGateway.broadcastNewProduct(newProductEvent);

    // Optionally publish to SNS for other services
    if (this.newProductTopicArn) {
      try {
        await this.snsClient.send(new PublishCommand({
          TopicArn: this.newProductTopicArn,
          Message: JSON.stringify(newProductEvent),
          Subject: 'New Product Available',
          MessageAttributes: {
            eventType: {
              DataType: 'String',
              StringValue: 'new_product',
            },
            sellerHandle: {
              DataType: 'String',
              StringValue: product.seller_handle,
            },
            videoId: {
              DataType: 'String',
              StringValue: product.video_id,
            },
          },
        }));
      } catch (error) {
        this.logger.error('Failed to publish new product event to SNS', {
          error: error.message,
          videoId: product.video_id,
        });
      }
    }
  }

  /**
   * Receive messages from SQS queue
   */
  private async receiveMessages(queueUrl: string): Promise<SQSMessage[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Long polling
      VisibilityTimeout: 300, // 5 minutes
      MessageAttributeNames: ['All'],
    });

    const response = await this.sqsClient.send(command);
    return (response.Messages as SQSMessage[]) || [];
  }

  /**
   * Delete message from SQS queue
   */
  private async deleteMessage(queueUrl: string, message: SQSMessage): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    });

    await this.sqsClient.send(command);
  }

  /**
   * Sleep utility
   */
  private parseEventFromSNS<T>(messageBody: string, eventType: string): T {
    try {
      // First, try to parse as direct event (for backward compatibility)
      const directEvent = JSON.parse(messageBody);

      // Check if it's already the expected event type (has required fields)
      if (this.isValidEvent(directEvent, eventType)) {
        return directEvent as T;
      }

      // Check if it's an SNS notification wrapper
      if (directEvent.Type === 'Notification' && directEvent.Message) {
        // Parse the inner Message field
        const innerMessage = JSON.parse(directEvent.Message);

        // Validate it's the expected event type
        if (this.isValidEvent(innerMessage, eventType)) {
          return innerMessage as T;
        }
      }

      throw new Error(`Message does not contain valid ${eventType} data`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      this.logger.error(`Failed to parse ${eventType} from message`, {
        error: errorMessage,
        messageBody: messageBody.substring(0, 200) + '...' // Log first 200 chars for debugging
      });
      throw new Error(`Failed to parse ${eventType}: ${errorMessage}`);
    }
  }

  private isValidEvent(event: any, eventType: string): boolean {
    switch (eventType) {
      case 'CaptionParsedEvent':
        return event.video_id && event.seller_handle && event.title !== undefined;
      case 'ThumbnailGeneratedEvent':
        return event.video_id && event.seller_handle && event.thumbnails && Array.isArray(event.thumbnails);
      default:
        return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
