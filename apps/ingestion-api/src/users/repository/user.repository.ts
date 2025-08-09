import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
  ScanCommand,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  CreateUserInput,
  UpdateUserInput,
  UserFilters,
  UserDynamoDBItem,
  SubscriptionStatus,
} from '../entities/user.entity';
import { UserRepositoryInterface } from '../../auth/interfaces/auth.interface';

@Injectable()
export class UserRepository implements UserRepositoryInterface {
  private readonly logger = new Logger(UserRepository.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    this.dynamoClient = new DynamoDBClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      ...(this.configService.get('DYNAMODB_ENDPOINT') && {
        endpoint: this.configService.get('DYNAMODB_ENDPOINT'),
      }),
    });
    this.tableName = this.configService.get('DYNAMODB_USERS_TABLE', 'tiktok-users-dev');
  }

  async createUser(userData: CreateUserInput): Promise<User> {
    const userId = uuidv4();
    const now = userData.createdAt || new Date().toISOString();
    const shopLink = `/shop/${userData.handle}`;

    const user: User = {
      userId,
      handle: userData.handle,
      phoneNumber: userData.phoneNumber || '', // Handle optional phone number
      shopLink,
      subscriptionStatus: userData.subscriptionStatus || SubscriptionStatus.PENDING,
      profilePhotoUrl: userData.profilePhotoUrl,
      displayName: userData.displayName,
      followerCount: userData.followerCount,
      isVerified: userData.isVerified,
      cognitoUserId: userData.cognitoUserId,
      trialEndDate: userData.trialEndsAt,
      createdAt: now,
      updatedAt: now,
    };

    // Build DynamoDB item with conditional GSI2 for phone number
    const dynamoItem: UserDynamoDBItem = {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`,
      GSI1PK: `HANDLE#${userData.handle}`,
      GSI1SK: `USER#${userId}`,
      EntityType: 'USER',
      ...user,
    };

    // Only add phone GSI if phone number is provided
    if (userData.phoneNumber) {
      dynamoItem.GSI2PK = `PHONE#${userData.phoneNumber}`;
      dynamoItem.GSI2SK = `USER#${userId}`;
    }

    try {
      await this.dynamoClient.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: marshall(dynamoItem, { removeUndefinedValues: true }),
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );

      this.logger.log(`User created successfully: ${userId}`);
      return user;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        this.logger.error(`User already exists: ${userId}`);
        throw new Error('User already exists');
      }
      this.logger.error(`Failed to create user: ${userId}`, error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const result = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `USER#${userId}`,
            SK: `USER#${userId}`,
          }),
        })
      );

      if (!result.Item) {
        return null;
      }

      const item = unmarshall(result.Item) as UserDynamoDBItem;
      return this.mapDynamoItemToUser(item);
    } catch (error) {
      this.logger.error(`Failed to get user by ID: ${userId}`, error);
      throw error;
    }
  }

  async getUserByHandle(handle: string): Promise<User | null> {
    try {
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: marshall({
            ':gsi1pk': `HANDLE#${handle}`,
          }),
          Limit: 1,
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const item = unmarshall(result.Items[0]) as UserDynamoDBItem;
      return this.mapDynamoItemToUser(item);
    } catch (error) {
      this.logger.error(`Failed to get user by handle: ${handle}`, error);
      throw error;
    }
  }

  async getUserByPhone(phoneNumber: string): Promise<User | null> {
    try {
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :gsi2pk',
          ExpressionAttributeValues: marshall({
            ':gsi2pk': `PHONE#${phoneNumber}`,
          }),
          Limit: 1,
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const item = unmarshall(result.Items[0]) as UserDynamoDBItem;
      return this.mapDynamoItemToUser(item);
    } catch (error) {
      this.logger.error(`Failed to get user by phone: ${phoneNumber}`, error);
      throw error;
    }
  }

  async getUserByCognitoId(cognitoUserId: string): Promise<User | null> {
    try {
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          FilterExpression: 'cognitoUserId = :cognitoUserId',
          ExpressionAttributeValues: marshall({
            ':cognitoUserId': cognitoUserId,
          }),
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const item = unmarshall(result.Items[0]) as UserDynamoDBItem;
      return this.mapDynamoItemToUser(item);
    } catch (error) {
      this.logger.error(`Failed to get user by Cognito ID: ${cognitoUserId}`, error);
      throw error;
    }
  }

  async updateUser(userId: string, updates: UpdateUserInput): Promise<User> {
    const now = new Date().toISOString();
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression dynamically
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    // Always update the updatedAt timestamp
    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    try {
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `USER#${userId}`,
            SK: `USER#${userId}`,
          }),
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: marshall(expressionAttributeValues, { removeUndefinedValues: true }),
          ConditionExpression: 'attribute_exists(PK)',
        })
      );

      this.logger.log(`User updated successfully: ${userId}`);
      
      // Return the updated user
      const updatedUser = await this.getUserById(userId);
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }
      
      return updatedUser;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        this.logger.error(`User not found for update: ${userId}`);
        throw new Error('User not found');
      }
      this.logger.error(`Failed to update user: ${userId}`, error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      await this.dynamoClient.send(
        new DeleteItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `USER#${userId}`,
            SK: `USER#${userId}`,
          }),
          ConditionExpression: 'attribute_exists(PK)',
        })
      );

      this.logger.log(`User deleted successfully: ${userId}`);
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        this.logger.error(`User not found for deletion: ${userId}`);
        return false;
      }
      this.logger.error(`Failed to delete user: ${userId}`, error);
      throw error;
    }
  }

  async findUsers(filters: UserFilters, limit: number = 20): Promise<User[]> {
    try {
      let command: QueryCommand;

      if (filters.handle) {
        command = new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: marshall({
            ':gsi1pk': `HANDLE#${filters.handle}`,
          }),
          Limit: limit,
        });
      } else if (filters.phoneNumber) {
        command = new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :gsi2pk',
          ExpressionAttributeValues: marshall({
            ':gsi2pk': `PHONE#${filters.phoneNumber}`,
          }),
          Limit: limit,
        });
      } else {
        // Scan with filters (less efficient, use sparingly)
        const filterExpressions: string[] = [];
        const expressionAttributeValues: Record<string, any> = {};

        if (filters.subscriptionStatus) {
          filterExpressions.push('subscriptionStatus = :subscriptionStatus');
          expressionAttributeValues[':subscriptionStatus'] = filters.subscriptionStatus;
        }

        if (filters.cognitoUserId) {
          filterExpressions.push('cognitoUserId = :cognitoUserId');
          expressionAttributeValues[':cognitoUserId'] = filters.cognitoUserId;
        }

        command = new QueryCommand({
          TableName: this.tableName,
          FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(' AND ') : undefined,
          ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0
            ? marshall(expressionAttributeValues, { removeUndefinedValues: true })
            : undefined,
          Limit: limit,
        });
      }

      const result = await this.dynamoClient.send(command);
      
      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapDynamoItemToUser(unmarshall(item) as UserDynamoDBItem));
    } catch (error) {
      this.logger.error('Failed to find users', error);
      throw error;
    }
  }

  private mapDynamoItemToUser(item: UserDynamoDBItem): User {
    return {
      userId: item.userId,
      handle: item.handle,
      phoneNumber: item.phoneNumber,
      shopLink: item.shopLink,
      subscriptionStatus: item.subscriptionStatus as SubscriptionStatus,
      profilePhotoUrl: item.profilePhotoUrl,
      displayName: item.displayName,
      followerCount: item.followerCount,
      isVerified: item.isVerified,
      cognitoUserId: item.cognitoUserId,
      trialStartDate: item.trialStartDate,
      trialEndDate: item.trialEndDate,
      subscriptionStartDate: item.subscriptionStartDate,
      subscriptionEndDate: item.subscriptionEndDate,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastLoginAt: item.lastLoginAt,
    };
  }

  async getAllUsers(limit?: number): Promise<User[]> {
    try {
      this.logger.log('Fetching all users with pagination');

      const users: User[] = [];
      let lastEvaluatedKey: any = undefined;
      let scannedCount = 0;
      const maxItems = limit || 10000; // Default limit to prevent memory issues

      do {
        const result = await this.dynamoClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'EntityType = :entityType',
            ExpressionAttributeValues: marshall({
              ':entityType': 'USER',
            }),
            Limit: Math.min(100, maxItems - scannedCount), // Scan in batches of 100
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (result.Items && result.Items.length > 0) {
          const batchUsers = result.Items.map(item => {
            const unmarshalledItem = unmarshall(item) as UserDynamoDBItem;
            return this.mapDynamoItemToUser(unmarshalledItem);
          });

          users.push(...batchUsers);
          scannedCount += batchUsers.length;
        }

        lastEvaluatedKey = result.LastEvaluatedKey;

        // Stop if we've reached the limit
        if (scannedCount >= maxItems) {
          break;
        }
      } while (lastEvaluatedKey);

      this.logger.log(`Retrieved ${users.length} users (scanned ${scannedCount} items)`);
      return users;
    } catch (error) {
      this.logger.error('Failed to get all users', error);
      throw error;
    }
  }

  async getUsersPaginated(options: {
    limit?: number;
    lastEvaluatedKey?: any;
    subscriptionStatus?: string;
  } = {}): Promise<{
    users: User[];
    lastEvaluatedKey?: any;
    scannedCount: number;
  }> {
    try {
      const { limit = 20, lastEvaluatedKey, subscriptionStatus } = options;

      this.logger.log(`Fetching users paginated - limit: ${limit}, hasLastKey: ${!!lastEvaluatedKey}`);

      let filterExpression = 'EntityType = :entityType';
      const expressionAttributeValues: any = {
        ':entityType': 'USER',
      };

      // Add subscription status filter if provided
      if (subscriptionStatus) {
        filterExpression += ' AND subscriptionStatus = :subscriptionStatus';
        expressionAttributeValues[':subscriptionStatus'] = subscriptionStatus;
      }

      const result = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: filterExpression,
          ExpressionAttributeValues: marshall(expressionAttributeValues),
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      const users: User[] = [];
      if (result.Items && result.Items.length > 0) {
        result.Items.forEach(item => {
          const unmarshalledItem = unmarshall(item) as UserDynamoDBItem;
          users.push(this.mapDynamoItemToUser(unmarshalledItem));
        });
      }

      this.logger.log(`Retrieved ${users.length} users in paginated query`);

      return {
        users,
        lastEvaluatedKey: result.LastEvaluatedKey,
        scannedCount: result.ScannedCount || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get users paginated', error);
      throw error;
    }
  }

  async searchUsersByPhone(phoneSearch: string, limit: number = 50): Promise<User[]> {
    try {
      this.logger.log(`Searching users by phone: ${phoneSearch}`);

      // Search using GSI2 (phone index) with begins_with
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI2',
          KeyConditionExpression: 'begins_with(GSI2PK, :phonePrefix)',
          ExpressionAttributeValues: marshall({
            ':phonePrefix': `PHONE#${phoneSearch}`,
          }),
          Limit: limit,
        })
      );

      const users: User[] = [];
      if (result.Items && result.Items.length > 0) {
        result.Items.forEach(item => {
          const unmarshalledItem = unmarshall(item) as UserDynamoDBItem;
          users.push(this.mapDynamoItemToUser(unmarshalledItem));
        });
      }

      this.logger.log(`Found ${users.length} users matching phone search`);
      return users;
    } catch (error) {
      this.logger.error(`Failed to search users by phone: ${error.message}`, error);
      throw error;
    }
  }

  async searchUsersByHandlePrefix(handlePrefix: string, limit: number = 50): Promise<User[]> {
    try {
      this.logger.log(`Searching users by handle prefix: ${handlePrefix}`);

      // Search using GSI1 (handle index) with begins_with
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'begins_with(GSI1PK, :handlePrefix)',
          ExpressionAttributeValues: marshall({
            ':handlePrefix': `HANDLE#${handlePrefix.toLowerCase()}`,
          }),
          Limit: limit,
        })
      );

      const users: User[] = [];
      if (result.Items && result.Items.length > 0) {
        result.Items.forEach(item => {
          const unmarshalledItem = unmarshall(item) as UserDynamoDBItem;
          users.push(this.mapDynamoItemToUser(unmarshalledItem));
        });
      }

      this.logger.log(`Found ${users.length} users matching handle prefix`);
      return users;
    } catch (error) {
      this.logger.error(`Failed to search users by handle prefix: ${error.message}`, error);
      throw error;
    }
  }

  async searchUsersByText(searchText: string, limit: number = 100): Promise<User[]> {
    try {
      this.logger.log(`Performing text search: ${searchText}`);

      const searchLower = searchText.toLowerCase();
      const users: User[] = [];
      let lastEvaluatedKey: any = undefined;
      let scannedCount = 0;
      const maxScan = limit * 10; // Scan more items to find matches

      do {
        const result = await this.dynamoClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'EntityType = :entityType AND (contains(#handle, :searchText) OR contains(#displayName, :searchText))',
            ExpressionAttributeNames: {
              '#handle': 'handle',
              '#displayName': 'displayName',
            },
            ExpressionAttributeValues: marshall({
              ':entityType': 'USER',
              ':searchText': searchLower,
            }),
            Limit: Math.min(100, maxScan - scannedCount),
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (result.Items && result.Items.length > 0) {
          result.Items.forEach(item => {
            const unmarshalledItem = unmarshall(item) as UserDynamoDBItem;
            users.push(this.mapDynamoItemToUser(unmarshalledItem));
          });
        }

        scannedCount += result.ScannedCount || 0;
        lastEvaluatedKey = result.LastEvaluatedKey;

        // Stop if we have enough results or scanned too many items
        if (users.length >= limit || scannedCount >= maxScan) {
          break;
        }
      } while (lastEvaluatedKey);

      this.logger.log(`Text search found ${users.length} users (scanned ${scannedCount} items)`);
      return users.slice(0, limit); // Ensure we don't return more than requested
    } catch (error) {
      this.logger.error(`Failed to perform text search: ${error.message}`, error);
      throw error;
    }
  }
}
