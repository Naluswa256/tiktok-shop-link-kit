import * as dotenv from 'dotenv';
import { ThumbnailGeneratorWorker } from './services/worker.service';
import { loadConfig, validateConfig } from './config';

// Load environment variables
dotenv.config();

// Simple logger
class Logger {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(`[ThumbnailGenerator] INFO: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(`[ThumbnailGenerator] ERROR: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[ThumbnailGenerator] WARN: ${message}`, meta ? JSON.stringify(meta) : '');
  }
}

const logger = new Logger();

// Global worker instance for cleanup
let worker: ThumbnailGeneratorWorker | null = null;

// Graceful shutdown handler
function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    if (worker) {
      try {
        await worker.stop();
        logger.info('Worker stopped successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error stopping worker', { error: errorMessage });
      }
    }
    
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Health check server for container environments
function startHealthCheckServer(worker: ThumbnailGeneratorWorker) {
  const http = require('http');
  
  const server = http.createServer((req: any, res: any) => {
    if (req.url === '/health') {
      const stats = worker.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: process.uptime(),
        ...stats
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

async function main() {
  try {
    logger.info('Starting Thumbnail Generator Worker');
    
    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);
    
    logger.info('Configuration loaded', {
      s3Bucket: config.s3BucketName,
      maxVideoSize: `${config.maxVideoSizeMB}MB`,
      maxDuration: `${config.maxVideoDurationSeconds}s`,
      thumbnailsToGenerate: config.thumbnailsToGenerate,
      awsRegion: config.awsRegion
    });

    // Create and start worker
    worker = new ThumbnailGeneratorWorker(config);
    
    // Start health check endpoint if running in container
    if (process.env.ENABLE_HEALTH_CHECK === 'true') {
      startHealthCheckServer(worker);
    }

    // Setup graceful shutdown
    setupGracefulShutdown();

    // Start the worker
    await worker.start();
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Failed to start thumbnail generator worker', {
      error: errorMessage,
      stack: errorStack
    });
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };
