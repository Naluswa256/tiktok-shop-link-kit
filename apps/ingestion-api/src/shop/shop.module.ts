import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopService } from './services/shop.service';
import { AnalyticsService } from './services/analytics.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ShopController],
  providers: [ShopService, AnalyticsService],
  exports: [ShopService, AnalyticsService],
})
export class ShopModule {}
