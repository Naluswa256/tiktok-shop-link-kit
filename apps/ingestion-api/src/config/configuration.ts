import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export interface AppConfig {
  port: number;
  environment: string;
  logLevel: string;
  corsOrigins: string[];
}

export interface AwsConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  dynamodbEndpoint?: string;
  dynamodbUsersTable: string;
}

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface ApifyConfig {
  token?: string;
  actorId: string;
  timeout: number;
}

export interface Configuration {
  app: AppConfig;
  aws: AwsConfig;
  cognito: CognitoConfig;
  jwt: JwtConfig;
  apify: ApifyConfig;
}

// Validation schema
export const configValidationSchema = Joi.object({
  // App configuration
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000,http://localhost:8080'),

  // AWS configuration
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  DYNAMODB_ENDPOINT: Joi.string().optional(),
  DYNAMODB_USERS_TABLE: Joi.string().default('tiktok-users-dev'),

  // Cognito configuration
  COGNITO_USER_POOL_ID: Joi.string().required(),
  COGNITO_CLIENT_ID: Joi.string().required(),
  COGNITO_REGION: Joi.string().default('us-east-1'),

  // JWT configuration
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  // Apify configuration
  APIFY_TOKEN: Joi.string().optional(),
  APIFY_ACTOR_ID: Joi.string().default('clockworks/tiktok-profile-scraper'),
  APIFY_TIMEOUT: Joi.number().default(60),
});

// Configuration factory functions
export const appConfig = registerAs('app', (): AppConfig => ({
  port: parseInt(process.env.PORT || '3001', 10),
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:8080')
    .split(',')
    .map(origin => origin.trim()),
}));

export const awsConfig = registerAs('aws', (): AwsConfig => ({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  dynamodbEndpoint: process.env.DYNAMODB_ENDPOINT,
  dynamodbUsersTable: process.env.DYNAMODB_USERS_TABLE || 'tiktok-users-dev',
}));

export const cognitoConfig = registerAs('cognito', (): CognitoConfig => ({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  clientId: process.env.COGNITO_CLIENT_ID!,
  region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
}));

export const jwtConfig = registerAs('jwt', (): JwtConfig => ({
  secret: process.env.JWT_SECRET!,
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
}));

export const apifyConfig = registerAs('apify', (): ApifyConfig => ({
  token: process.env.APIFY_TOKEN,
  actorId: process.env.APIFY_ACTOR_ID || 'clockworks/tiktok-profile-scraper',
  timeout: parseInt(process.env.APIFY_TIMEOUT || '60', 10),
}));

// Helper function to get all configurations
export const getAllConfigs = () => [
  appConfig,
  awsConfig,
  cognitoConfig,
  jwtConfig,
  apifyConfig,
];

// Environment-specific validation
export const validateEnvironment = () => {
  const { error, value } = configValidationSchema.validate(process.env, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join(', ');
    throw new Error(`Configuration validation error: ${errorMessages}`);
  }

  return value;
};

// Configuration loader with validation
export const loadConfiguration = (): Configuration => {
  // Validate environment first
  validateEnvironment();

  return {
    app: {
      port: parseInt(process.env.PORT || '3001', 10),
      environment: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:8080')
        .split(',')
        .map(origin => origin.trim()),
    },
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      dynamodbEndpoint: process.env.DYNAMODB_ENDPOINT,
      dynamodbUsersTable: process.env.DYNAMODB_USERS_TABLE || 'tiktok-users-dev',
    },
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      clientId: process.env.COGNITO_CLIENT_ID!,
      region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
    },
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    },
    apify: {
      token: process.env.APIFY_TOKEN,
      actorId: process.env.APIFY_ACTOR_ID || 'clockworks/tiktok-profile-scraper',
      timeout: parseInt(process.env.APIFY_TIMEOUT || '60', 10),
    },
  };
};
