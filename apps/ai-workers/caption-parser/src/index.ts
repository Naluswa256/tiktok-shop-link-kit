#!/usr/bin/env node

import 'dotenv/config';
import { CaptionParserWorker } from './services/worker.service';
import { loadConfig, validateConfig, getEnvironmentInfo } from './config';

// Simple logger
const logger = {
  info: (message: string, meta?: any) => console.log(`INFO: ${message}`, meta ? JSON.stringify(meta) : ''),
  error: (message: string, meta?: any) => console.error(`ERROR: ${message}`, meta ? JSON.stringify(meta) : ''),
  warn: (message: string, meta?: any) => console.warn(`WARN: ${message}`, meta ? JSON.stringify(meta) : ''),
  debug: (message: string, meta?: any) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`DEBUG: ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
};

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
let worker: CaptionParserWorker | null = null;

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  if (worker) {
    await worker.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  if (worker) {
    await worker.stop();
  }
  process.exit(0);
});

async function main() {
  try {
    logger.info('Starting Caption Parser Worker');
    
    // Log environment info
    const envInfo = getEnvironmentInfo();
    logger.info('Environment Info', envInfo);

    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);
    
    logger.info('Configuration loaded', {
      llmProvider: config.llmProvider,
      llmModel: config.llmModel,
      batchSize: config.batchSize,
      awsRegion: config.awsRegion
    });

    // Create and start worker
    worker = new CaptionParserWorker(config);
    
    // Start health check endpoint if running in container
    if (process.env.ENABLE_HEALTH_CHECK === 'true') {
      startHealthCheckServer(worker);
    }

    // Start the worker
    await worker.start();
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Failed to start Caption Parser Worker', {
      error: errorMessage,
      stack: errorStack
    });
    process.exit(1);
  }
}

function startHealthCheckServer(worker: CaptionParserWorker) {
  const http = require('http');
  
  const server = http.createServer((req: any, res: any) => {
    if (req.url === '/health') {
      const stats = worker.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats,
        environment: getEnvironmentInfo()
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  const port = process.env.HEALTH_CHECK_PORT || 8080;
  server.listen(port, () => {
    logger.info(`Health check server listening on port ${port}`);
  });
}

// Lambda handler for AWS Lambda deployment
export const lambdaHandler = async (event: any, context: any) => {
  logger.info('Lambda handler invoked', { event, context });
  
  try {
    const config = loadConfig();
    validateConfig(config);
    
    const worker = new CaptionParserWorker(config);
    
    // Process messages for a limited time in Lambda
    const startTime = Date.now();
    const maxRunTime = (context.getRemainingTimeInMillis?.() || 300000) - 10000; // Leave 10s buffer
    
    while (Date.now() - startTime < maxRunTime) {
      // Poll and process one batch
      await worker['pollAndProcessMessages']();
      
      // Check if we should continue
      if (Date.now() - startTime > maxRunTime * 0.8) {
        break;
      }
    }
    
    const stats = worker.getStats();
    logger.info('Lambda execution completed', { stats, runtime: Date.now() - startTime });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        stats,
        runtime: Date.now() - startTime
      })
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Lambda execution failed', { error: errorMessage });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage
      })
    };
  }
};

// Start the application if not in Lambda environment
if (require.main === module) {
  main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Application startup failed', { error: errorMessage });
    process.exit(1);
  });
}
