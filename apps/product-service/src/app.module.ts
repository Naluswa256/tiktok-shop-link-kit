import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { EventProcessorService } from './events/event-processor.service';
import { DynamoDBService } from './database/dynamodb.service';
import { WebSocketGateway } from './websocket/websocket.gateway';
import { CleanupService } from './tasks/cleanup.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    ProductsModule,
    CatalogModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DynamoDBService,
    EventProcessorService,
    WebSocketGateway,
    CleanupService,
  ],
})
export class AppModule {}
