import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EventProcessorService } from './events/event-processor.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Global exception filters (order matters - most specific first)
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new AllExceptionsFilter(),
  );

  // Global interceptors
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global validation pipe with enhanced options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation with enhanced configuration
  const config = new DocumentBuilder()
    .setTitle('TikTok Commerce Link Hub - Product Service')
    .setDescription(`
      ## Event-Driven Product Assembly API

      This service automatically assembles products from TikTok videos using AI workers:

      1. **Caption Parser** extracts product details from TikTok captions
      2. **Thumbnail Generator** creates multiple product thumbnails
      3. **Product Assembly** merges data and stores complete products
      4. **Real-time Updates** via WebSocket for instant frontend updates

      ### Key Features:
      - 🔄 Event-driven architecture with SQS/SNS
      - 📊 Real-time WebSocket notifications
      - 🗄️ DynamoDB with optimized queries
      - 🛡️ Production-ready error handling
      - 📈 Comprehensive monitoring endpoints
    `)
    .setVersion('1.0')
    .addTag('products', 'Product management and retrieval')
    .addTag('monitoring', 'Health checks and statistics')
    .addServer('http://localhost:3002', 'Development server')
    .addServer('https://api.tiktok-commerce.com', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'TikTok Commerce API',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3002;
  const nodeEnv = configService.get('NODE_ENV') || 'development';

  // Start event processing for product assembly
  try {
    const eventProcessor = app.get(EventProcessorService);
    await eventProcessor.startProcessing();
    logger.log('✅ Event processing started successfully');
  } catch (error) {
    logger.error('❌ Failed to start event processing', error);
    // Don't exit - API can still serve existing products
  }

  await app.listen(port);

  // Enhanced startup logging
  logger.log(`🚀 Product Service started successfully`);
  logger.log(`📍 Environment: ${nodeEnv}`);
  logger.log(`🌐 Server: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`� WebSocket endpoint: ws://localhost:${port}/products`);
  logger.log(`💾 Health check: http://localhost:${port}/health/database`);

  if (nodeEnv === 'development') {
    logger.log(`🔧 Development mode - detailed error messages enabled`);
  }
}

bootstrap();
