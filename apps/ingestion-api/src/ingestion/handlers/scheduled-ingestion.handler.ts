import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IngestionModule } from '../ingestion.module';
import { IngestionService } from '../services/ingestion.service';

/**
 * AWS Lambda handler for scheduled TikTok video ingestion
 * Triggered by EventBridge at 06:00 and 18:00 UTC daily
 */
export const handler = async (event: any, context: any) => {
  const logger = new Logger('ScheduledIngestionHandler');
  
  try {
    logger.log('Starting scheduled ingestion Lambda function');
    logger.log(`Event: ${JSON.stringify(event)}`);
    logger.log(`Context: ${JSON.stringify(context)}`);

    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(IngestionModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get the ingestion service
    const ingestionService = app.get(IngestionService);

    // Run the ingestion job
    const startTime = Date.now();
    const result = await ingestionService.runIngestionJob();
    const duration = Date.now() - startTime;

    logger.log(`Ingestion job completed in ${duration}ms`);
    logger.log(`Results: ${JSON.stringify(result)}`);

    // Close the application context
    await app.close();

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Ingestion job completed successfully',
        results: result,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }),
    };

  } catch (error) {
    logger.error('Scheduled ingestion failed', error);

    // Return error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Ingestion job failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

/**
 * Local testing function
 */
export const runLocal = async () => {
  const logger = new Logger('LocalIngestionTest');
  
  try {
    logger.log('Running ingestion locally for testing');
    
    const result = await handler({
      source: 'aws.events',
      'detail-type': 'Scheduled Event',
      detail: {},
    }, {
      functionName: 'scheduled-ingestion-local',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:scheduled-ingestion-local',
      memoryLimitInMB: '512',
      remainingTimeInMillis: 300000,
    });
    
    logger.log('Local test completed');
    logger.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    logger.error('Local test failed', error);
  }
};

// Allow running locally for testing
if (require.main === module) {
  runLocal();
}
