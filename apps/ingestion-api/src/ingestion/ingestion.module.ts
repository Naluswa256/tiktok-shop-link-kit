import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestionController } from './ingestion.controller';
import { IngestionService as ScheduledIngestionService } from './services/ingestion.service';
import { ApifyService } from './services/apify.service';
import { MonitoringService } from './services/monitoring.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [IngestionController],
  providers: [
    ScheduledIngestionService,
    ApifyService,
    MonitoringService,
  ],
  exports: [
    ScheduledIngestionService,
    ApifyService,
    MonitoringService,
  ],
})
export class IngestionModule {}
