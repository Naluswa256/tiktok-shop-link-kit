import { Injectable } from '@nestjs/common';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

@Injectable()
export class HealthService {
  private dynamoClient: DynamoDBClient;

  constructor() {
    this.dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async getHealth() {
    const dbHealth = await this.getDatabaseHealth();

    return {
      status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'product-service',
      version: '1.0.0',
      checks: {
        database: dbHealth,
      },
    };
  }

  async getDatabaseHealth() {
    try {
      // Test DynamoDB connectivity by listing tables
      const command = new ListTablesCommand({ Limit: 1 });
      await this.dynamoClient.send(command);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'dynamodb',
        connection: 'connected',
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'dynamodb',
        connection: 'disconnected',
        error: error.message,
      };
    }
  }
}
