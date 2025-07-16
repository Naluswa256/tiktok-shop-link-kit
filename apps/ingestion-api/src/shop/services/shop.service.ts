import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
  ShopLinkGeneratedEvent,
  Shop,
  CreateShopInput,
  ShopServiceInterface
} from '../interfaces/shop.interface';

@Injectable()
export class ShopService implements ShopServiceInterface {
  private readonly logger = new Logger(ShopService.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly snsClient: SNSClient;
  private readonly shopsTableName: string;
  private readonly newVideoPostedTopicArn: string;

  constructor(private readonly configService: ConfigService) {
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
    this.newVideoPostedTopicArn = this.configService.get('SNS_NEW_VIDEO_POSTED_TOPIC_ARN', '');
  }

  /**
   * Create a new shop entry and emit ShopLinkGeneratedEvent
   */
  async createShop(shopData: CreateShopInput): Promise<Shop> {
    const now = new Date().toISOString();
    const shopLink = `/shop/${shopData.handle}`;

    const shop: Shop = {
      handle: shopData.handle,
      phone: shopData.phone,
      shop_link: shopLink,
      subscription_status: shopData.subscription_status || 'trial',
      created_at: now,
      user_id: shopData.user_id,
      display_name: shopData.display_name,
      profile_photo_url: shopData.profile_photo_url,
      follower_count: shopData.follower_count,
      is_verified: shopData.is_verified,
    };

    // Create DynamoDB item
    const dynamoItem = {
      handle: shop.handle,
      phone: shop.phone,
      shop_link: shop.shop_link,
      subscription_status: shop.subscription_status,
      created_at: shop.created_at,
      ...(shop.user_id && { user_id: shop.user_id }),
      ...(shop.display_name && { display_name: shop.display_name }),
      ...(shop.profile_photo_url && { profile_photo_url: shop.profile_photo_url }),
      ...(shop.follower_count && { follower_count: shop.follower_count }),
      ...(shop.is_verified !== undefined && { is_verified: shop.is_verified }),
    };

    try {
      // Save to DynamoDB
      await this.dynamoClient.send(
        new PutItemCommand({
          TableName: this.shopsTableName,
          Item: marshall(dynamoItem),
          ConditionExpression: 'attribute_not_exists(handle)', // Prevent duplicates
        })
      );

      this.logger.log(`Shop created successfully: ${shop.handle}`);

      // Emit ShopLinkGeneratedEvent
      await this.emitShopLinkGeneratedEvent(shop);

      return shop;
    } catch (error) {
      this.logger.error(`Failed to create shop: ${shop.handle}`, error);
      throw error;
    }
  }

  /**
   * Get shop by handle
   */
  async getShopByHandle(handle: string): Promise<Shop | null> {
    try {
      const result = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.shopsTableName,
          Key: marshall({ handle }),
        })
      );

      if (!result.Item) {
        return null;
      }

      return unmarshall(result.Item) as Shop;
    } catch (error) {
      this.logger.error(`Failed to get shop by handle: ${handle}`, error);
      throw error;
    }
  }

  /**
   * Get shop by phone number
   */
  async getShopByPhone(phone: string): Promise<Shop | null> {
    try {
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.shopsTableName,
          IndexName: 'PhoneIndex',
          KeyConditionExpression: 'phone = :phone',
          ExpressionAttributeValues: marshall({
            ':phone': phone,
          }),
          Limit: 1,
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return unmarshall(result.Items[0]) as Shop;
    } catch (error) {
      this.logger.error(`Failed to get shop by phone: ${phone}`, error);
      throw error;
    }
  }

  /**
   * Update shop subscription status
   */
  async updateShopSubscription(handle: string, subscriptionStatus: 'trial' | 'paid'): Promise<void> {
    try {
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.shopsTableName,
          Key: marshall({ handle }),
          UpdateExpression: 'SET subscription_status = :status, updated_at = :updatedAt',
          ExpressionAttributeValues: marshall({
            ':status': subscriptionStatus,
            ':updatedAt': new Date().toISOString(),
          }),
          ConditionExpression: 'attribute_exists(handle)',
        })
      );

      this.logger.log(`Shop subscription updated: ${handle} -> ${subscriptionStatus}`);
    } catch (error) {
      this.logger.error(`Failed to update shop subscription: ${handle}`, error);
      throw error;
    }
  }

  /**
   * Get shops by subscription status
   */
  async getShopsBySubscriptionStatus(subscriptionStatus: 'trial' | 'paid'): Promise<Shop[]> {
    try {
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.shopsTableName,
          IndexName: 'SubscriptionIndex',
          KeyConditionExpression: 'subscription_status = :status',
          ExpressionAttributeValues: marshall({
            ':status': subscriptionStatus,
          }),
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => unmarshall(item) as Shop);
    } catch (error) {
      this.logger.error(`Failed to get shops by subscription status: ${subscriptionStatus}`, error);
      throw error;
    }
  }

  /**
   * Emit ShopLinkGeneratedEvent to SNS
   */
  private async emitShopLinkGeneratedEvent(shop: Shop): Promise<void> {
    if (!this.newVideoPostedTopicArn) {
      this.logger.warn('SNS topic ARN not configured, skipping event emission');
      return;
    }

    const event: ShopLinkGeneratedEvent = {
      handle: shop.handle,
      phone: shop.phone,
      shop_link: shop.shop_link,
      subscription_status: shop.subscription_status,
      created_at: shop.created_at,
    };

    try {
      await this.snsClient.send(
        new PublishCommand({
          TopicArn: this.newVideoPostedTopicArn,
          Message: JSON.stringify(event),
          Subject: 'Shop Link Generated',
          MessageAttributes: {
            eventType: {
              DataType: 'String',
              StringValue: 'ShopLinkGenerated',
            },
            handle: {
              DataType: 'String',
              StringValue: shop.handle,
            },
          },
        })
      );

      this.logger.log(`ShopLinkGeneratedEvent emitted for handle: ${shop.handle}`);
    } catch (error) {
      this.logger.error(`Failed to emit ShopLinkGeneratedEvent for handle: ${shop.handle}`, error);
      // Don't throw error here - shop creation should succeed even if event emission fails
    }
  }
}
