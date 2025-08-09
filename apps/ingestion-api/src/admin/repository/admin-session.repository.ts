import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { AdminSession, AdminSessionDynamoDBItem, CreateAdminSessionInput } from '../entities/admin-session.entity';

@Injectable()
export class AdminSessionRepository {
  private readonly logger = new Logger(AdminSessionRepository.name);
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.region');
    const endpoint = this.configService.get<string>('aws.dynamodbEndpoint');
    
    const client = new DynamoDBClient({
      region,
      ...(endpoint && { endpoint }),
    });
    
    this.dynamoClient = DynamoDBDocumentClient.from(client);
    this.tableName = this.configService.get<string>('admin.sessionsTable') || 'AdminSessions';
  }

  async createSession(sessionData: CreateAdminSessionInput): Promise<AdminSession> {
    const now = new Date().toISOString();
    
    const session: AdminSession = {
      sessionId: sessionData.sessionId,
      adminUsername: sessionData.adminUsername,
      issuedAt: now,
      expiresAt: sessionData.expiresAt,
      ip: sessionData.ip,
      userAgent: sessionData.userAgent,
      isRevoked: false,
      createdAt: now,
      updatedAt: now,
    };

    const dynamoItem: AdminSessionDynamoDBItem = {
      PK: `SESSION#${sessionData.sessionId}`,
      SK: `SESSION#${sessionData.sessionId}`,
      GSI1PK: `ADMIN#${sessionData.adminUsername}`,
      GSI1SK: `SESSION#${sessionData.sessionId}`,
      EntityType: 'ADMIN_SESSION',
      ...session,
    };

    try {
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoItem,
        })
      );

      this.logger.log(`Admin session created: ${sessionData.sessionId}`);
      return session;
    } catch (error) {
      this.logger.error(`Failed to create admin session: ${error.message}`, error);
      throw new Error('Failed to create admin session');
    }
  }

  async getSession(sessionId: string): Promise<AdminSession | null> {
    try {
      const result = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: `SESSION#${sessionId}`,
            SK: `SESSION#${sessionId}`,
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      const item = result.Item as AdminSessionDynamoDBItem;
      
      // Check if session is expired or revoked
      const now = new Date();
      const expiresAt = new Date(item.expiresAt);
      
      if (now > expiresAt || item.isRevoked) {
        return null;
      }

      return {
        sessionId: item.sessionId,
        adminUsername: item.adminUsername,
        issuedAt: item.issuedAt,
        expiresAt: item.expiresAt,
        ip: item.ip,
        userAgent: item.userAgent,
        isRevoked: item.isRevoked,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get admin session: ${error.message}`, error);
      return null;
    }
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      await this.dynamoClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: `SESSION#${sessionId}`,
            SK: `SESSION#${sessionId}`,
          },
        })
      );

      this.logger.log(`Admin session revoked: ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to revoke admin session: ${error.message}`, error);
      return false;
    }
  }

  async revokeAllSessionsForAdmin(adminUsername: string): Promise<boolean> {
    try {
      // Query all sessions for the admin
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `ADMIN#${adminUsername}`,
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return true;
      }

      // Delete all sessions
      const deletePromises = result.Items.map(item => 
        this.dynamoClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          })
        )
      );

      await Promise.all(deletePromises);
      this.logger.log(`All sessions revoked for admin: ${adminUsername}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to revoke all sessions for admin: ${error.message}`, error);
      return false;
    }
  }

  async cleanupExpiredSessions(): Promise<{ deletedCount: number; errors: number }> {
    try {
      this.logger.log('Starting cleanup of expired admin sessions');

      const now = new Date().toISOString();
      let deletedCount = 0;
      let errors = 0;
      let lastEvaluatedKey: any = undefined;

      do {
        // Scan for expired sessions in batches
        const scanResult = await this.dynamoClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'EntityType = :entityType AND (expiresAt < :now OR isRevoked = :revoked)',
            ExpressionAttributeValues: marshall({
              ':entityType': 'ADMIN_SESSION',
              ':now': now,
              ':revoked': true,
            }),
            ProjectionExpression: 'PK, SK, sessionId, expiresAt, isRevoked',
            Limit: 25, // Process in small batches to avoid timeouts
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (scanResult.Items && scanResult.Items.length > 0) {
          // Delete expired sessions in batches
          const deletePromises = scanResult.Items.map(async (item) => {
            try {
              const unmarshalledItem = unmarshall(item);
              await this.dynamoClient.send(
                new DeleteCommand({
                  TableName: this.tableName,
                  Key: {
                    PK: unmarshalledItem.PK,
                    SK: unmarshalledItem.SK,
                  },
                })
              );
              deletedCount++;
              this.logger.debug(`Deleted expired session: ${unmarshalledItem.sessionId}`);
            } catch (deleteError) {
              errors++;
              this.logger.error(`Failed to delete session ${item.sessionId}: ${deleteError.message}`);
            }
          });

          await Promise.all(deletePromises);
        }

        lastEvaluatedKey = scanResult.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      this.logger.log(`Cleanup completed: ${deletedCount} sessions deleted, ${errors} errors`);
      return { deletedCount, errors };
    } catch (error) {
      this.logger.error(`Failed to cleanup expired sessions: ${error.message}`, error);
      throw error;
    }
  }

  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    revokedSessions: number;
  }> {
    try {
      const now = new Date().toISOString();
      let totalSessions = 0;
      let activeSessions = 0;
      let expiredSessions = 0;
      let revokedSessions = 0;
      let lastEvaluatedKey: any = undefined;

      do {
        const scanResult = await this.dynamoClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'EntityType = :entityType',
            ExpressionAttributeValues: marshall({
              ':entityType': 'ADMIN_SESSION',
            }),
            ProjectionExpression: 'expiresAt, isRevoked',
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (scanResult.Items) {
          for (const item of scanResult.Items) {
            const unmarshalledItem = unmarshall(item);
            totalSessions++;

            if (unmarshalledItem.isRevoked) {
              revokedSessions++;
            } else if (new Date(unmarshalledItem.expiresAt) < new Date(now)) {
              expiredSessions++;
            } else {
              activeSessions++;
            }
          }
        }

        lastEvaluatedKey = scanResult.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        revokedSessions,
      };
    } catch (error) {
      this.logger.error(`Failed to get session stats: ${error.message}`, error);
      throw error;
    }
  }
}
