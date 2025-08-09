import * as Joi from 'joi';
import { config } from 'dotenv';
import { AppConfig, DatabaseConfig, AWSConfig, AIConfig } from './types/config.types';
import { appSchema } from './schemas/app.schema';
import { databaseSchema } from './schemas/database.schema';
import { awsSchema } from './schemas/aws.schema';
import { aiSchema } from './schemas/ai.schema';

export class ConfigService {
  private static instance: ConfigService;
  private appConfig: AppConfig;
  private databaseConfig: DatabaseConfig;
  private awsConfig: AWSConfig;
  private aiConfig: AIConfig;

  private constructor() {
    // Load environment variables
    config();
    
    // Validate and load configurations
    this.loadConfigurations();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfigurations(): void {
    try {
      this.appConfig = this.validateConfig(appSchema, {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3000', 10),
        apiVersion: process.env.API_VERSION || 'v1',
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8080'],
        jwtSecret: process.env.JWT_SECRET || 'default-secret',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        logLevel: process.env.LOG_LEVEL || 'info'
      });

      this.databaseConfig = this.validateConfig(databaseSchema, {
        dynamodb: {
          region: process.env.AWS_REGION || 'us-east-1',
          endpoint: process.env.DYNAMODB_ENDPOINT,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          tables: {
            videos: process.env.DYNAMODB_VIDEOS_TABLE || 'tiktok-videos',
            products: process.env.DYNAMODB_PRODUCTS_TABLE || 'tiktok-products',
            jobs: process.env.DYNAMODB_JOBS_TABLE || 'tiktok-processing-jobs',
            users: process.env.DYNAMODB_USERS_TABLE || 'tiktok-users',
            tags: process.env.DYNAMODB_TAGS_TABLE || 'tiktok-tags',
            analytics: process.env.DYNAMODB_ANALYTICS_TABLE || 'tiktok-analytics'
          }
        },
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0', 10),
          ttl: parseInt(process.env.REDIS_TTL || '3600', 10)
        }
      });

      this.awsConfig = this.validateConfig(awsSchema, {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        s3: {
          bucket: process.env.S3_BUCKET || 'tiktok-commerce-assets',
          region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
          endpoint: process.env.S3_ENDPOINT
        },
        sns: {
          topicArn: process.env.SNS_TOPIC_ARN || '',
          region: process.env.SNS_REGION || process.env.AWS_REGION || 'us-east-1'
        },
        sqs: {
          region: process.env.SQS_REGION || process.env.AWS_REGION || 'us-east-1',
          queues: {
            captionAnalysis: process.env.SQS_CAPTION_ANALYSIS_QUEUE || 'tiktok-caption-analysis-queue',
            thumbnailGeneration: process.env.SQS_THUMBNAIL_GENERATION_QUEUE || 'tiktok-thumbnail-generation-queue',

          }
        },
        lambda: {
          region: process.env.LAMBDA_REGION || process.env.AWS_REGION || 'us-east-1'
        }
      });

      this.aiConfig = this.validateConfig(aiSchema, {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || '',
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000', 10),
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
        },
        processing: {
          confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.7'),
          maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
          timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10)
        }
      });

    } catch (error) {
      console.error('Configuration validation failed:', error);
      process.exit(1);
    }
  }

  private validateConfig<T>(schema: Joi.ObjectSchema, config: any): T {
    const { error, value } = schema.validate(config, {
      allowUnknown: false,
      abortEarly: false
    });

    if (error) {
      throw new Error(`Configuration validation error: ${error.message}`);
    }

    return value;
  }

  // Getters for different config sections
  public getAppConfig(): AppConfig {
    return this.appConfig;
  }

  public getDatabaseConfig(): DatabaseConfig {
    return this.databaseConfig;
  }

  public getAWSConfig(): AWSConfig {
    return this.awsConfig;
  }

  public getAIConfig(): AIConfig {
    return this.aiConfig;
  }

  // Convenience methods
  public get(key: string): any {
    return process.env[key];
  }

  public getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  public getInt(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required environment variable ${key} is not set`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} is not a valid integer`);
    }
    return parsed;
  }

  public getFloat(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required environment variable ${key} is not set`);
    }
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} is not a valid float`);
    }
    return parsed;
  }

  public getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value.toLowerCase() === 'true';
  }

  public getArray(key: string, separator: string = ','): string[] {
    const value = process.env[key];
    if (!value) {
      return [];
    }
    return value.split(separator).map(item => item.trim());
  }

  public isDevelopment(): boolean {
    return this.appConfig.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.appConfig.nodeEnv === 'production';
  }

  public isTest(): boolean {
    return this.appConfig.nodeEnv === 'test';
  }
}

// Export singleton instance
export const configService = ConfigService.getInstance();
