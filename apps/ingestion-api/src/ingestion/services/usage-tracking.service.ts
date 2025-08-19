import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export interface SellerUsage {
  handle: string;
  month: string; // YYYY-MM format
  apifyRunsUsed: number;
  cuUsed: number;
  onDemandRequests: number;
  shortPollingEnabled: boolean;
  planType: 'free' | 'paid';
  quotas: {
    maxApifyRuns: number;
    maxCuUsage: number;
    maxOnDemandRequests: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UsageQuotas {
  free: {
    maxApifyRuns: number;
    maxCuUsage: number;
    maxOnDemandRequests: number;
  };
  paid: {
    maxApifyRuns: number;
    maxCuUsage: number;
    maxOnDemandRequests: number;
  };
}

@Injectable()
export class UsageTrackingService {
  private readonly logger = new Logger(UsageTrackingService.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly tableName: string;
  
  // Default quotas based on cost analysis
  private readonly defaultQuotas: UsageQuotas = {
    free: {
      maxApifyRuns: 10,        // ~10 runs per month (0.5 CU = ~$0.20)
      maxCuUsage: 5,           // 5 CU per month (~$2.00)
      maxOnDemandRequests: 5,  // 5 manual sync requests per month
    },
    paid: {
      maxApifyRuns: 130,       // ~130 runs per month (6.5 CU = ~$2.60 from 10,000 UGX)
      maxCuUsage: 65,          // 65 CU per month (~$26.00)
      maxOnDemandRequests: 50, // 50 manual sync requests per month
    },
  };

  constructor(
    private readonly configService: ConfigService,
  ) {
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
    
    this.tableName = this.configService.get('USAGE_TABLE_NAME', 'SellerUsage');
  }

  /**
   * Get current usage for a seller
   */
  async getSellerUsage(handle: string, planType: 'free' | 'paid' = 'free'): Promise<SellerUsage> {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    try {
      const result = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `USAGE#${currentMonth}`,
          }),
        })
      );

      if (result.Item) {
        return unmarshall(result.Item) as SellerUsage;
      }

      // Create new usage record if doesn't exist
      const newUsage: SellerUsage = {
        handle,
        month: currentMonth,
        apifyRunsUsed: 0,
        cuUsed: 0,
        onDemandRequests: 0,
        shortPollingEnabled: false,
        planType,
        quotas: this.defaultQuotas[planType],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.createUsageRecord(newUsage);
      return newUsage;

    } catch (error) {
      this.logger.error(`Failed to get usage for seller ${handle}`, error);
      throw error;
    }
  }

  /**
   * Check if seller can make an Apify run
   */
  async canMakeApifyRun(handle: string, estimatedCu: number = 0.05): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const usage = await this.getSellerUsage(handle);
      
      if (usage.apifyRunsUsed >= usage.quotas.maxApifyRuns) {
        return {
          allowed: false,
          reason: `Monthly Apify run quota exceeded (${usage.apifyRunsUsed}/${usage.quotas.maxApifyRuns})`
        };
      }

      if (usage.cuUsed + estimatedCu > usage.quotas.maxCuUsage) {
        return {
          allowed: false,
          reason: `Monthly compute unit quota would be exceeded (${usage.cuUsed + estimatedCu}/${usage.quotas.maxCuUsage} CU)`
        };
      }

      return { allowed: true };

    } catch (error) {
      this.logger.error(`Failed to check Apify run permission for ${handle}`, error);
      return { allowed: false, reason: 'Internal error checking quotas' };
    }
  }

  /**
   * Check if seller can make an on-demand request
   */
  async canMakeOnDemandRequest(handle: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const usage = await this.getSellerUsage(handle);
      
      if (usage.onDemandRequests >= usage.quotas.maxOnDemandRequests) {
        return {
          allowed: false,
          reason: `Monthly on-demand request quota exceeded (${usage.onDemandRequests}/${usage.quotas.maxOnDemandRequests})`
        };
      }

      return { allowed: true };

    } catch (error) {
      this.logger.error(`Failed to check on-demand request permission for ${handle}`, error);
      return { allowed: false, reason: 'Internal error checking quotas' };
    }
  }

  /**
   * Record Apify run usage
   */
  async recordApifyRun(handle: string, cuUsed: number): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `USAGE#${currentMonth}`,
          }),
          UpdateExpression: 'ADD apifyRunsUsed :runs, cuUsed :cu SET updatedAt = :updatedAt',
          ExpressionAttributeValues: marshall({
            ':runs': 1,
            ':cu': cuUsed,
            ':updatedAt': new Date().toISOString(),
          }),
        })
      );

      this.logger.log(`Recorded Apify run for ${handle}: ${cuUsed} CU used`);

    } catch (error) {
      this.logger.error(`Failed to record Apify run for ${handle}`, error);
      throw error;
    }
  }

  /**
   * Record on-demand request
   */
  async recordOnDemandRequest(handle: string): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `USAGE#${currentMonth}`,
          }),
          UpdateExpression: 'ADD onDemandRequests :requests SET updatedAt = :updatedAt',
          ExpressionAttributeValues: marshall({
            ':requests': 1,
            ':updatedAt': new Date().toISOString(),
          }),
        })
      );

      this.logger.log(`Recorded on-demand request for ${handle}`);

    } catch (error) {
      this.logger.error(`Failed to record on-demand request for ${handle}`, error);
      throw error;
    }
  }

  /**
   * Update seller plan type and quotas
   */
  async updateSellerPlan(handle: string, planType: 'free' | 'paid'): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const quotas = this.defaultQuotas[planType];
      
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `USAGE#${currentMonth}`,
          }),
          UpdateExpression: 'SET planType = :planType, quotas = :quotas, updatedAt = :updatedAt',
          ExpressionAttributeValues: marshall({
            ':planType': planType,
            ':quotas': quotas,
            ':updatedAt': new Date().toISOString(),
          }),
        })
      );

      this.logger.log(`Updated plan for ${handle} to ${planType}`);

    } catch (error) {
      this.logger.error(`Failed to update plan for ${handle}`, error);
      throw error;
    }
  }

  /**
   * Enable/disable short polling for a seller
   */
  async setShortPolling(handle: string, enabled: boolean): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({
            PK: `SELLER#${handle}`,
            SK: `USAGE#${currentMonth}`,
          }),
          UpdateExpression: 'SET shortPollingEnabled = :enabled, updatedAt = :updatedAt',
          ExpressionAttributeValues: marshall({
            ':enabled': enabled,
            ':updatedAt': new Date().toISOString(),
          }),
        })
      );

      this.logger.log(`${enabled ? 'Enabled' : 'Disabled'} short polling for ${handle}`);

    } catch (error) {
      this.logger.error(`Failed to set short polling for ${handle}`, error);
      throw error;
    }
  }

  /**
   * Get usage statistics for monitoring
   */
  async getUsageStatistics(): Promise<{
    totalSellers: number;
    freePlanSellers: number;
    paidPlanSellers: number;
    totalCuUsed: number;
    totalApifyRuns: number;
  }> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Use Query with GSI to get all usage records for current month
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'EntityTypeIndex',
          KeyConditionExpression: 'EntityType = :entityType AND begins_with(SK, :monthPrefix)',
          ExpressionAttributeValues: marshall({
            ':entityType': 'SELLER_USAGE',
            ':monthPrefix': `USAGE#${currentMonth}`,
          }),
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return {
          totalSellers: 0,
          freePlanSellers: 0,
          paidPlanSellers: 0,
          totalCuUsed: 0,
          totalApifyRuns: 0,
        };
      }

      let totalSellers = 0;
      let freePlanSellers = 0;
      let paidPlanSellers = 0;
      let totalCuUsed = 0;
      let totalApifyRuns = 0;

      for (const item of result.Items) {
        const usage = unmarshall(item) as SellerUsage;
        totalSellers++;

        if (usage.planType === 'free') {
          freePlanSellers++;
        } else {
          paidPlanSellers++;
        }

        totalCuUsed += usage.cuUsed || 0;
        totalApifyRuns += usage.apifyRunsUsed || 0;
      }

      return {
        totalSellers,
        freePlanSellers,
        paidPlanSellers,
        totalCuUsed,
        totalApifyRuns,
      };

    } catch (error) {
      this.logger.error('Failed to get usage statistics', error);
      // Return zeros on error to avoid breaking monitoring
      return {
        totalSellers: 0,
        freePlanSellers: 0,
        paidPlanSellers: 0,
        totalCuUsed: 0,
        totalApifyRuns: 0,
      };
    }
  }

  private async createUsageRecord(usage: SellerUsage): Promise<void> {
    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `SELLER#${usage.handle}`,
          SK: `USAGE#${usage.month}`,
          EntityType: 'SELLER_USAGE',
          ...usage,
        }),
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
  }
}
