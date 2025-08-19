import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { OnboardingVideoCandidate, OnboardingSession } from './onboarding.service';

@Injectable()
export class OnboardingSessionService {
  private readonly logger = new Logger(OnboardingSessionService.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    this.dynamoClient = new DynamoDBClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      ...(this.configService.get('NODE_ENV') === 'development' && {
        endpoint: 'http://localhost:4566',
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
        },
      }),
    });
    
    this.tableName = this.configService.get('ONBOARDING_SESSIONS_TABLE_NAME', 'OnboardingSessions');
  }

  /**
   * Create a new onboarding session
   */
  async createSession(
    handle: string,
    planType: 'free' | 'paid',
    videoCandidates: OnboardingVideoCandidate[],
    actualCuUsed?: number
  ): Promise<string> {
    const sessionId = `session_${handle}_${Date.now()}`;
    const session: OnboardingSession = {
      handle,
      sessionId,
      planType,
      videoCandidates,
      selectedVideoIds: [],
      totalVideosScraped: videoCandidates.length,
      cuUsed: actualCuUsed || 0.05, // Actual or estimated CU used for scraping
      status: 'in-progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.dynamoClient.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: marshall({
            PK: `SELLER#${handle}`,
            SK: `SESSION#${sessionId}`,
            EntityType: 'ONBOARDING_SESSION',
            ...session,
            ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days TTL
          }),
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );

      this.logger.log(`Created onboarding session ${sessionId} for ${handle}`);
      return sessionId;

    } catch (error) {
      this.logger.error(`Failed to create onboarding session for ${handle}`, error);
      throw error;
    }
  }

  /**
   * Get an onboarding session
   */
  async getSession(handle: string, sessionId: string): Promise<OnboardingSession | null> {
    try {
      const result = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `SESSION#${sessionId}`,
          }),
        })
      );

      if (!result.Item) {
        return null;
      }

      const session = unmarshall(result.Item) as OnboardingSession;
      return session;

    } catch (error) {
      this.logger.error(`Failed to get onboarding session ${sessionId} for ${handle}`, error);
      throw error;
    }
  }

  /**
   * Update session with selected video IDs
   */
  async updateSelectedVideos(
    handle: string,
    sessionId: string,
    selectedVideoIds: string[]
  ): Promise<void> {
    try {
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `SESSION#${sessionId}`,
          }),
          UpdateExpression: 'SET selectedVideoIds = :selectedIds, updatedAt = :updatedAt',
          ExpressionAttributeValues: marshall({
            ':selectedIds': selectedVideoIds,
            ':updatedAt': new Date().toISOString(),
          }),
          ConditionExpression: 'attribute_exists(PK)', // Ensure session exists
        })
      );

      this.logger.log(`Updated selected videos for session ${sessionId}: ${selectedVideoIds.length} videos`);

    } catch (error) {
      this.logger.error(`Failed to update selected videos for session ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * Mark session as completed
   */
  async completeSession(
    handle: string,
    sessionId: string,
    processedCount: number
  ): Promise<void> {
    try {
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `SESSION#${sessionId}`,
          }),
          UpdateExpression: 'SET #status = :status, processedCount = :processedCount, updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: marshall({
            ':status': 'completed',
            ':processedCount': processedCount,
            ':updatedAt': new Date().toISOString(),
          }),
          ConditionExpression: 'attribute_exists(PK)',
        })
      );

      this.logger.log(`Completed onboarding session ${sessionId} for ${handle}: ${processedCount} videos processed`);

    } catch (error) {
      this.logger.error(`Failed to complete onboarding session ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * Mark session as failed
   */
  async failSession(
    handle: string,
    sessionId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `SESSION#${sessionId}`,
          }),
          UpdateExpression: 'SET #status = :status, errorMessage = :errorMessage, updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: marshall({
            ':status': 'failed',
            ':errorMessage': errorMessage,
            ':updatedAt': new Date().toISOString(),
          }),
          ConditionExpression: 'attribute_exists(PK)',
        })
      );

      this.logger.log(`Failed onboarding session ${sessionId} for ${handle}: ${errorMessage}`);

    } catch (error) {
      this.logger.error(`Failed to mark session as failed ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * Get video candidate by ID from session
   */
  async getVideoCandidate(
    handle: string,
    sessionId: string,
    videoId: string
  ): Promise<OnboardingVideoCandidate | null> {
    try {
      const session = await this.getSession(handle, sessionId);
      if (!session) {
        return null;
      }

      const candidate = session.videoCandidates.find(v => v.id === videoId);
      return candidate || null;

    } catch (error) {
      this.logger.error(`Failed to get video candidate ${videoId} from session ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * Delete session (cleanup)
   */
  async deleteSession(handle: string, sessionId: string): Promise<void> {
    try {
      await this.dynamoClient.send(
        new DeleteItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `SESSION#${sessionId}`,
          }),
        })
      );

      this.logger.log(`Deleted onboarding session ${sessionId} for ${handle}`);

    } catch (error) {
      this.logger.error(`Failed to delete onboarding session ${sessionId}`, error);
      throw error;
    }
  }
}
