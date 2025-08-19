import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestionService as ScheduledIngestionService } from './services/ingestion.service';
import { ApifyService } from './services/apify.service';
import { MonitoringService } from './services/monitoring.service';
import { IngestionCoordinatorService } from './services/ingestion-coordinator.service';
import { UsageTrackingService } from './services/usage-tracking.service';
import { OnboardingService } from './services/onboarding.service';
import { OnboardingSessionService } from './services/onboarding-session.service';
import { IngestionCoordinatorController } from './controllers/ingestion-coordinator.controller';
import { SecretsService } from '../common/services/secrets.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [
    IngestionCoordinatorController,
  ],
  providers: [
    ScheduledIngestionService,
    ApifyService,
    MonitoringService,
    IngestionCoordinatorService,
    UsageTrackingService,
    OnboardingService,
    OnboardingSessionService,
    SecretsService,
  ],
  exports: [
    ScheduledIngestionService,
    ApifyService,
    MonitoringService,
    IngestionCoordinatorService,
    UsageTrackingService,
    OnboardingService,
    OnboardingSessionService,
  ],
})
export class IngestionModule {}
