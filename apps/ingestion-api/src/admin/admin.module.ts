import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { AdminController } from './controllers/admin.controller';

// Services
import { AdminAuthService } from './services/admin-auth.service';
import { AdminCleanupService } from './services/admin-cleanup.service';
import { AdminUserService } from './services/admin-user.service';

// Repository
import { AdminSessionRepository } from './repository/admin-session.repository';
import { UserRepository } from '../users/repository/user.repository';

// Guards
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Enable scheduled tasks
    // JWT module for admin tokens
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('admin.jwtSecret'),
        signOptions: {
          expiresIn: configService.get<string>('admin.jwtAccessExpiresIn', '900s'),
        },
        verifyOptions: {
          ignoreExpiration: false,
        },
      }),
      inject: [ConfigService],
    }),
    // Throttler for rate limiting admin login
    ThrottlerModule.forRoot([
      {
        name: 'admin-login',
        ttl: 60000, // 1 minute
        limit: 5, // 5 attempts per minute
      },
    ]),
  ],
  controllers: [AdminController],
  providers: [
    // Services
    AdminAuthService,
    AdminUserService,
    AdminCleanupService,

    // Repositories
    AdminSessionRepository,
    UserRepository,

    // Guards
    AdminJwtAuthGuard,
  ],
  exports: [
    AdminAuthService,
    AdminUserService,
    AdminSessionRepository,
  ],
})
export class AdminModule {}
