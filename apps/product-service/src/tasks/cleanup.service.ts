import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DynamoDBService } from '../database/dynamodb.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private dynamoDBService: DynamoDBService) {}

  /**
   * Clean up expired staging data every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredStagingData() {
    this.logger.log('Starting cleanup of expired staging data');
    
    try {
      const cleanedCount = await this.dynamoDBService.cleanupExpiredStagingData();
      
      this.logger.log(`Cleanup completed: ${cleanedCount} expired items removed`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired staging data', {
        error: error.message,
      });
    }
  }

  /**
   * Log system health metrics every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async logSystemHealth() {
    this.logger.debug('System health check');
    
    // Add any health checks here
    // For example: check DynamoDB connectivity, SQS queue depths, etc.
  }
}
