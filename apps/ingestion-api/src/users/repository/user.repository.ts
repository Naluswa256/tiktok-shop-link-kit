import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
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
    const now = new Date().toISOString();
    const shopLink = `/shop/${userData.handle}`;

    const user: User = {
      userId,
      handle: userData.handle,
      phoneNumber: userData.phoneNumber,
      shopLink,
      subscriptionStatus: SubscriptionStatus.PENDING,
      profilePhotoUrl: userData.profilePhotoUrl,
      displayName: userData.displayName,
      followerCount: userData.followerCount,
      isVerified: userData.isVerified,
      cognitoUserId: userData.cognitoUserId,
      createdAt: now,
      updatedAt: now,
    };

    const dynamoItem: UserDynamoDBItem = {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`,
      GSI1PK: `HANDLE#${userData.handle}`,
      GSI1SK: `USER#${userId}`,
      GSI2PK: `PHONE#${userData.phoneNumber}`,
      GSI2SK: `USER#${userId}`,
      EntityType: 'USER',
      ...user,
    };

    try {
      await this.dynamoClient.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: marshall(dynamoItem),
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
          ExpressionAttributeValues: marshall(expressionAttributeValues),
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
            ? marshall(expressionAttributeValues) 
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
}
