import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestionService as ScheduledIngestionService } from './services/ingestion.service';
import { ApifyService } from './services/apify.service';
import { MonitoringService } from './services/monitoring.service';
import { SecretsService } from '../common/services/secrets.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [
    ScheduledIngestionService,
    ApifyService,
    MonitoringService,
    SecretsService,
  ],
  exports: [
    ScheduledIngestionService,
    ApifyService,
    MonitoringService,
  ],
})
export class IngestionModule {}
