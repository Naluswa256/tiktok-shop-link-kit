import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

// Controllers
import { AuthController } from './controllers/auth.controller';

// Services
import { AuthService } from './services/auth.service';
import { TikTokLookupService } from './services/tiktok-lookup.service';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SubscriptionGuard } from './guards/subscription.guard';

// Repository
import { UserRepository } from '../users/repository/user.repository';

// Shop module
import { ShopService } from '../shop/services/shop.service';

// Common modules
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { ConditionalResponseInterceptor } from '../common/interceptors/response.interceptor';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'fallback-secret-key'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
        },
        verifyOptions: {
          ignoreExpiration: false,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Services
    AuthService,
    TikTokLookupService,
    UserRepository,
    ShopService,
    
    // Guards
    JwtAuthGuard,
    SubscriptionGuard,
    
    // Global providers
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ConditionalResponseInterceptor,
    },
  ],
  exports: [
    AuthService,
    TikTokLookupService,
    UserRepository,
    JwtAuthGuard,
    SubscriptionGuard,
  ],
})
export class AuthModule {}
