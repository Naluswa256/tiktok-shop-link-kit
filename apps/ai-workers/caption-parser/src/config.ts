import { WorkerConfig } from './types';

export function loadConfig(): WorkerConfig {
  // Validate required environment variables
  const requiredVars = [
    'SQS_QUEUE_URL',
    'SNS_TOPIC_ARN',
    'AWS_REGION'
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Required environment variable ${varName} is not set`);
    }
  }

  // Determine LLM provider and validate its requirements
  const llmProvider = (process.env.LLM_PROVIDER || 'ollama') as 'openrouter' | 'ollama' | 'openai';
  
  if (llmProvider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required when using OpenRouter');
  }
  
  if (llmProvider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when using OpenAI');
  }

  const config: WorkerConfig = {
    // AWS Configuration
    sqsQueueUrl: process.env.SQS_QUEUE_URL!,
    snsTopicArn: process.env.SNS_TOPIC_ARN!,
    awsRegion: process.env.AWS_REGION!,

    // LLM Configuration
    llmProvider,
    llmModel: process.env.LLM_MODEL || getDefaultModel(llmProvider),
    llmApiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',

    // Worker Configuration
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    batchSize: parseInt(process.env.BATCH_SIZE || '10'),
    visibilityTimeout: parseInt(process.env.VISIBILITY_TIMEOUT || '300'), // 5 minutes
    waitTimeSeconds: parseInt(process.env.WAIT_TIME_SECONDS || '20') // Long polling
  };

  return config;
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'openrouter':
      return 'microsoft/phi-3-mini-4k-instruct'; // Free tier friendly
    case 'ollama':
      return 'phi3:mini'; // Lightweight local model
    case 'openai':
      return 'gpt-3.5-turbo'; // Most cost-effective OpenAI model
    default:
      return 'phi3:mini';
  }
}

export function validateConfig(config: WorkerConfig): void {
  // Validate numeric values
  if (config.maxRetries < 1 || config.maxRetries > 10) {
    throw new Error('maxRetries must be between 1 and 10');
  }

  if (config.batchSize < 1 || config.batchSize > 10) {
    throw new Error('batchSize must be between 1 and 10');
  }

  if (config.visibilityTimeout < 30 || config.visibilityTimeout > 43200) {
    throw new Error('visibilityTimeout must be between 30 and 43200 seconds');
  }

  if (config.waitTimeSeconds < 0 || config.waitTimeSeconds > 20) {
    throw new Error('waitTimeSeconds must be between 0 and 20');
  }

  // Validate URLs
  try {
    new URL(config.sqsQueueUrl);
  } catch {
    throw new Error('Invalid SQS queue URL');
  }

  if (config.ollamaBaseUrl) {
    try {
      new URL(config.ollamaBaseUrl);
    } catch {
      throw new Error('Invalid Ollama base URL');
    }
  }
}

export function getEnvironmentInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };
}
