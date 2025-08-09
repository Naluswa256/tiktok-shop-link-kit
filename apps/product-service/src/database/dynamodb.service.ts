import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ProductAssemblyData, AssembledProduct } from '../events/types';

interface DynamoDBError extends Error {
  name: string;
  $metadata?: {
    httpStatusCode?: number;
    requestId?: string;
    attempts?: number;
  };
}

@Injectable()
export class DynamoDBService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamoDBService.name);
  private readonly docClient: DynamoDBDocumentClient;
  private readonly productsTable: string;
  private readonly stagingTable: string;
  private readonly maxRetries: number;
  private readonly baseRetryDelay: number;
  private readonly maxRetryDelay: number;

  constructor(private configService: ConfigService) {
    // Production-ready DynamoDB client configuration
    const clientConfig: DynamoDBClientConfig = {
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      maxAttempts: 3,
      retryMode: 'adaptive',
      requestHandler: {
        connectionTimeout: 5000,
        requestTimeout: 30000,
      },
    };

    // Add credentials if provided (for local development)
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    const client = new DynamoDBClient(clientConfig);

    // Configure document client with marshalling options
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });

    this.productsTable = this.configService.get('DYNAMODB_PRODUCTS_TABLE', 'tiktok-commerce-products-dev');
    this.stagingTable = this.configService.get('DYNAMODB_STAGING_TABLE', 'tiktok-commerce-staging-dev');
    this.maxRetries = this.configService.get('DYNAMODB_MAX_RETRIES', 3);
    this.baseRetryDelay = this.configService.get('DYNAMODB_BASE_RETRY_DELAY', 100);
    this.maxRetryDelay = this.configService.get('DYNAMODB_MAX_RETRY_DELAY', 5000);
  }

  async onModuleInit() {
    this.logger.log('DynamoDB service initialized', {
      productsTable: this.productsTable,
      stagingTable: this.stagingTable,
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    });

    // Verify table connectivity
    await this.verifyTableConnectivity();
  }

  async onModuleDestroy() {
    this.logger.log('DynamoDB service shutting down');
    // Cleanup any pending operations if needed
  }

  /**
   * Verify table connectivity on startup
   */
  private async verifyTableConnectivity(): Promise<void> {
    try {
      // Test connectivity by describing tables (lightweight operation)
      await Promise.all([
        this.testTableAccess(this.productsTable),
        this.testTableAccess(this.stagingTable),
      ]);

      this.logger.log('DynamoDB table connectivity verified');
    } catch (error) {
      this.logger.error('Failed to verify DynamoDB connectivity', {
        error: error.message,
        productsTable: this.productsTable,
        stagingTable: this.stagingTable,
      });
      throw error;
    }
  }

  /**
   * Test table access with a lightweight query
   */
  private async testTableAccess(tableName: string): Promise<void> {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'seller_handle = :test',
      ExpressionAttributeValues: {
        ':test': '__connectivity_test__',
      },
      Limit: 1,
    });

    await this.docClient.send(command);
  }

  /**
   * Execute operation with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, any> = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        if (attempt > 1) {
          this.logger.log(`${operationName} succeeded on attempt ${attempt}`, {
            ...context,
            duration,
            attempt,
          });
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        const dynamoError = error as DynamoDBError;

        // Don't retry on certain errors
        if (this.shouldNotRetry(dynamoError)) {
          this.logger.debug(`${operationName} failed with non-retryable error`, {
            ...context,
            error: dynamoError.message,
            errorName: dynamoError.name,
            attempt,
          });
          throw error;
        }

        if (attempt === this.maxRetries) {
          this.logger.error(`${operationName} failed after ${this.maxRetries} attempts`, {
            ...context,
            error: dynamoError.message,
            errorName: dynamoError.name,
            attempts: attempt,
          });
          break;
        }

        const delay = this.calculateRetryDelay(attempt);
        this.logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
          ...context,
          error: dynamoError.message,
          attempt,
          nextRetryIn: delay,
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`${operationName} failed after ${this.maxRetries} attempts`);
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: DynamoDBError): boolean {
    const nonRetryableErrors = [
      'ValidationException',
      'ConditionalCheckFailedException',
      'ItemCollectionSizeLimitExceededException',
      'ResourceNotFoundException',
      'AccessDeniedException',
    ];

    return nonRetryableErrors.includes(error.name);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.baseRetryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const delay = Math.min(exponentialDelay + jitter, this.maxRetryDelay);
    return Math.floor(delay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save or update product assembly data in staging table with retry logic
   */
  async saveProductAssemblyData(data: ProductAssemblyData): Promise<void> {
    const operation = async () => {
      const command = new PutCommand({
        TableName: this.stagingTable,
        Item: {
          ...data,
          // Ensure consistent data types
          ttl: Number(data.ttl),
          is_complete: Boolean(data.is_complete),
        },
        // Add condition to prevent overwriting newer data
        ConditionExpression: 'attribute_not_exists(updated_at) OR updated_at <= :current_updated_at',
        ExpressionAttributeValues: {
          ':current_updated_at': data.updated_at,
        },
      });

      return await this.docClient.send(command);
    };

    await this.executeWithRetry(
      operation,
      'saveProductAssemblyData',
      {
        videoId: data.video_id,
        sellerHandle: data.seller_handle,
        isComplete: data.is_complete,
      }
    );

    this.logger.debug('Saved product assembly data to staging', {
      videoId: data.video_id,
      sellerHandle: data.seller_handle,
      isComplete: data.is_complete,
    });
  }

  /**
   * Get product assembly data from staging table with retry logic
   */
  async getProductAssemblyData(videoId: string, sellerHandle: string): Promise<ProductAssemblyData | null> {
    const operation = async () => {
      const command = new GetCommand({
        TableName: this.stagingTable,
        Key: {
          video_id: videoId,
          seller_handle: sellerHandle,
        },
        ConsistentRead: true, // Ensure we get the latest data
      });

      const result = await this.docClient.send(command);
      return result.Item as ProductAssemblyData || null;
    };

    return await this.executeWithRetry(
      operation,
      'getProductAssemblyData',
      { videoId, sellerHandle }
    );
  }

  /**
   * Delete product assembly data from staging table with retry logic
   */
  async deleteProductAssemblyData(videoId: string, sellerHandle: string): Promise<void> {
    const operation = async () => {
      const command = new DeleteCommand({
        TableName: this.stagingTable,
        Key: {
          video_id: videoId,
          seller_handle: sellerHandle,
        },
        // Optional: Add condition to ensure we're deleting the right item
        ConditionExpression: 'attribute_exists(video_id)',
      });

      return await this.docClient.send(command);
    };

    await this.executeWithRetry(
      operation,
      'deleteProductAssemblyData',
      { videoId, sellerHandle }
    );

    this.logger.debug('Deleted product assembly data from staging', {
      videoId,
      sellerHandle,
    });
  }

  /**
   * Save assembled product to products table with idempotency and retry logic
   */
  async saveProduct(product: AssembledProduct): Promise<void> {
    const operation = async () => {
      // Ensure data consistency and proper types
      const productItem = {
        ...product,
        price: product.price !== null ? Number(product.price) : null,
        thumbnails: product.thumbnails.map(thumb => ({
          ...thumb,
          frame_timestamp: Number(thumb.frame_timestamp),
          frame_index: Number(thumb.frame_index),
          confidence_score: Number(thumb.confidence_score),
          quality_score: Number(thumb.quality_score),
          is_primary: Boolean(thumb.is_primary),
        })),
        primary_thumbnail: {
          ...product.primary_thumbnail,
          frame_timestamp: Number(product.primary_thumbnail.frame_timestamp),
          frame_index: Number(product.primary_thumbnail.frame_index),
          confidence_score: Number(product.primary_thumbnail.confidence_score),
          quality_score: Number(product.primary_thumbnail.quality_score),
          is_primary: Boolean(product.primary_thumbnail.is_primary),
        },
        processing_metadata: {
          ...product.processing_metadata,
          video_duration: Number(product.processing_metadata.video_duration),
          frames_analyzed: Number(product.processing_metadata.frames_analyzed),
          thumbnails_generated: Number(product.processing_metadata.thumbnails_generated),
          processing_time_ms: Number(product.processing_metadata.processing_time_ms),
        },
        confidence_score: product.confidence_score ? Number(product.confidence_score) : undefined,
      };

      const command = new PutCommand({
        TableName: this.productsTable,
        Item: productItem,
        ConditionExpression: 'attribute_not_exists(video_id)', // Prevent duplicates
      });

      return await this.docClient.send(command);
    };

    try {
      await this.executeWithRetry(
        operation,
        'saveProduct',
        {
          videoId: product.video_id,
          sellerHandle: product.seller_handle,
          title: product.title,
          price: product.price,
          thumbnailsCount: product.thumbnails.length,
        }
      );

      this.logger.log('Saved assembled product', {
        videoId: product.video_id,
        sellerHandle: product.seller_handle,
        title: product.title,
        price: product.price,
        thumbnailsCount: product.thumbnails.length,
      });
    } catch (error) {
      const dynamoError = error as DynamoDBError;

      if (dynamoError.name === 'ConditionalCheckFailedException') {
        this.logger.warn('Product already exists, skipping save (idempotency)', {
          videoId: product.video_id,
          sellerHandle: product.seller_handle,
        });
        return; // Idempotency - product already exists
      }

      this.logger.error('Failed to save assembled product', {
        error: dynamoError.message,
        errorName: dynamoError.name,
        videoId: product.video_id,
        sellerHandle: product.seller_handle,
      });
      throw error;
    }
  }

  /**
   * Get products by seller handle with pagination, optimized for performance
   */
  async getProductsBySellerHandle(
    sellerHandle: string,
    options: {
      limit?: number;
      lastEvaluatedKey?: any;
      since?: string; // ISO timestamp for incremental updates
    } = {}
  ): Promise<{
    products: AssembledProduct[];
    lastEvaluatedKey?: any;
    count: number;
  }> {
    const operation = async () => {
      const { limit = 20, lastEvaluatedKey, since } = options;

      // Validate and sanitize inputs
      const sanitizedLimit = Math.min(Math.max(limit, 1), 100); // Cap between 1-100

      let filterExpression: string | undefined;
      let expressionAttributeValues: any = {
        ':seller_handle': sellerHandle,
      };
      let expressionAttributeNames: any = {};

      if (since) {
        // Validate ISO timestamp format
        const sinceDate = new Date(since);
        if (isNaN(sinceDate.getTime())) {
          throw new Error('Invalid since timestamp format. Use ISO 8601 format.');
        }

        filterExpression = '#created_at > :since';
        expressionAttributeValues[':since'] = since;
        expressionAttributeNames['#created_at'] = 'created_at';
      }

      const command = new QueryCommand({
        TableName: this.productsTable,
        KeyConditionExpression: 'seller_handle = :seller_handle',
        ExpressionAttributeValues: expressionAttributeValues,
        ...(Object.keys(expressionAttributeNames).length > 0 && {
          ExpressionAttributeNames: expressionAttributeNames,
        }),
        FilterExpression: filterExpression,
        ScanIndexForward: false, // Sort by SK (video_id) in descending order for newest first
        Limit: sanitizedLimit,
        ExclusiveStartKey: lastEvaluatedKey,
        // Performance optimization: only return necessary attributes for list view
        ProjectionExpression: [
          'seller_handle',
          'video_id',
          'title',
          'price',
          'sizes',
          'tags',
          'primary_thumbnail',
          'created_at',
          'updated_at',
          'confidence_score'
        ].join(', '),
      });

      const result = await this.docClient.send(command);

      return {
        products: (result.Items as AssembledProduct[]) || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
      };
    };

    return await this.executeWithRetry(
      operation,
      'getProductsBySellerHandle',
      {
        sellerHandle,
        limit: options.limit,
        since: options.since,
        hasLastKey: !!options.lastEvaluatedKey
      }
    );
  }

  /**
   * Get a specific product with full details
   */
  async getProduct(sellerHandle: string, videoId: string): Promise<AssembledProduct | null> {
    const operation = async () => {
      const command = new GetCommand({
        TableName: this.productsTable,
        Key: {
          seller_handle: sellerHandle,
          video_id: videoId,
        },
        ConsistentRead: false, // Eventually consistent is fine for product details
      });

      const result = await this.docClient.send(command);
      return result.Item as AssembledProduct || null;
    };

    return await this.executeWithRetry(
      operation,
      'getProduct',
      { sellerHandle, videoId }
    );
  }

  /**
   * Clean up expired staging data (called by scheduled task) - production optimized
   */
  async cleanupExpiredStagingData(): Promise<number> {
    const operation = async () => {
      const now = Math.floor(Date.now() / 1000);
      let totalDeleted = 0;
      let lastEvaluatedKey: any = undefined;

      do {
        // Scan in batches to avoid timeout and memory issues
        const scanCommand = new ScanCommand({
          TableName: this.stagingTable,
          FilterExpression: 'attribute_exists(ttl) AND ttl < :now',
          ExpressionAttributeValues: {
            ':now': now,
          },
          Limit: 25, // Process in small batches
          ExclusiveStartKey: lastEvaluatedKey,
          ProjectionExpression: 'video_id, seller_handle, ttl', // Only get keys for deletion
        });

        const result = await this.docClient.send(scanCommand);
        const expiredItems = result.Items || [];
        lastEvaluatedKey = result.LastEvaluatedKey;

        if (expiredItems.length > 0) {
          // Batch delete for efficiency
          await this.batchDeleteStagingItems(expiredItems);
          totalDeleted += expiredItems.length;

          this.logger.debug(`Deleted batch of ${expiredItems.length} expired staging items`);

          // Small delay to avoid overwhelming DynamoDB
          await this.sleep(100);
        }
      } while (lastEvaluatedKey);

      this.logger.log(`Cleanup completed: ${totalDeleted} expired staging items removed`);
      return totalDeleted;
    };

    return await this.executeWithRetry(
      operation,
      'cleanupExpiredStagingData',
      {}
    );
  }

  /**
   * Batch delete staging items for efficiency
   */
  private async batchDeleteStagingItems(items: any[]): Promise<void> {
    // DynamoDB batch write can handle up to 25 items
    const batchSize = 25;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const deleteRequests = batch.map(item => ({
        DeleteRequest: {
          Key: {
            video_id: item.video_id,
            seller_handle: item.seller_handle,
          },
        },
      }));

      const command = new BatchWriteCommand({
        RequestItems: {
          [this.stagingTable]: deleteRequests,
        },
      });

      await this.docClient.send(command);
    }
  }

  /**
   * Get staging table statistics for monitoring
   */
  async getStagingTableStats(): Promise<{
    totalItems: number;
    completeItems: number;
    incompleteItems: number;
    expiredItems: number;
  }> {
    const operation = async () => {
      const now = Math.floor(Date.now() / 1000);
      let totalItems = 0;
      let completeItems = 0;
      let incompleteItems = 0;
      let expiredItems = 0;
      let lastEvaluatedKey: any = undefined;

      do {
        const command = new ScanCommand({
          TableName: this.stagingTable,
          Limit: 100,
          ExclusiveStartKey: lastEvaluatedKey,
          ProjectionExpression: 'is_complete, ttl',
        });

        const result = await this.docClient.send(command);
        const items = result.Items || [];
        lastEvaluatedKey = result.LastEvaluatedKey;

        for (const item of items) {
          totalItems++;

          if (item.ttl && item.ttl < now) {
            expiredItems++;
          } else if (item.is_complete) {
            completeItems++;
          } else {
            incompleteItems++;
          }
        }
      } while (lastEvaluatedKey);

      return {
        totalItems,
        completeItems,
        incompleteItems,
        expiredItems,
      };
    };

    return await this.executeWithRetry(
      operation,
      'getStagingTableStats',
      {}
    );
  }

  /**
   * Health check method for monitoring
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    productsTable: 'accessible' | 'error';
    stagingTable: 'accessible' | 'error';
    latency: number;
    timestamp: string;
  }> {
    const startTime = Date.now();
    let productsTableStatus: 'accessible' | 'error' = 'accessible';
    let stagingTableStatus: 'accessible' | 'error' = 'accessible';

    try {
      await Promise.all([
        this.testTableAccess(this.productsTable).catch(() => {
          productsTableStatus = 'error';
        }),
        this.testTableAccess(this.stagingTable).catch(() => {
          stagingTableStatus = 'error';
        }),
      ]);
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
    }

    const latency = Date.now() - startTime;
    const status = productsTableStatus === 'accessible' && stagingTableStatus === 'accessible'
      ? 'healthy'
      : 'unhealthy';

    return {
      status,
      productsTable: productsTableStatus,
      stagingTable: stagingTableStatus,
      latency,
      timestamp: new Date().toISOString(),
    };
  }
}
