import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Req, 
  Res, 
  Query, 
  Param,
  UseGuards, 
  HttpCode, 
  HttpStatus,
  Logger,
  ValidationPipe,
  UsePipes,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

import { AdminAuthService, AdminLoginRequest } from '../services/admin-auth.service';
import { AdminUserService, AdminUserListQuery } from '../services/admin-user.service';
import { AdminCleanupService } from '../services/admin-cleanup.service';
import { AdminJwtAuthGuard, AdminPublic, AuthenticatedAdminRequest } from '../guards/admin-jwt-auth.guard';
import { SubscriptionStatus } from '../../users/entities/user.entity';

// DTOs
export class AdminLoginDto implements AdminLoginRequest {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class AdminUserListQueryDto implements AdminUserListQuery {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @IsOptional()
  @IsEnum(['createdAt', 'handle', 'subscriptionStatus'])
  sortBy?: 'createdAt' | 'handle' | 'subscriptionStatus';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);
  private readonly refreshCookieName: string;
  private readonly isProduction: boolean;

  constructor(
    private adminAuthService: AdminAuthService,
    private adminUserService: AdminUserService,
    private adminCleanupService: AdminCleanupService,
    private configService: ConfigService,
  ) {
    this.refreshCookieName = this.configService.get<string>('admin.refreshCookieName', 'admin_refresh');
    this.isProduction = this.configService.get<string>('app.environment') === 'production';
  }

  @Post('login')
  @AdminPublic()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }))
  async login(
    @Body() loginDto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const requestId = req.headers['x-request-id'] || 'unknown';
    const startTime = Date.now();

    try {
      this.logger.log(`Admin login attempt from IP: ${req.ip}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
        username: loginDto.username,
      });

      const { response, refreshToken } = await this.adminAuthService.login(
        loginDto,
        req.ip,
        req.get('User-Agent'),
      );

      // Set refresh token as HttpOnly cookie
      this.setRefreshTokenCookie(res, refreshToken);

      const duration = Date.now() - startTime;
      this.logger.log(`Admin login successful (${duration}ms)`, {
        ip: req.ip,
        username: loginDto.username,
        requestId,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Admin login failed: ${error.message} (${duration}ms)`, {
        ip: req.ip,
        username: loginDto.username,
        requestId,
        duration,
        error: error.message,
      });
      throw error;
    }
  }

  @Post('refresh')
  @AdminPublic()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const refreshToken = req.cookies[this.refreshCookieName];
      
      if (!refreshToken) {
        throw new BadRequestException('Refresh token not found');
      }

      const { response, newRefreshToken } = await this.adminAuthService.refresh(
        refreshToken,
        req.ip,
        req.get('User-Agent'),
      );

      // Set new refresh token if rotated
      if (newRefreshToken) {
        this.setRefreshTokenCookie(res, newRefreshToken);
      }

      this.logger.log('Admin token refresh successful');
      return response;
    } catch (error) {
      this.logger.error(`Admin token refresh failed: ${error.message}`);
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AuthenticatedAdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const refreshToken = req.cookies[this.refreshCookieName];
      
      if (refreshToken) {
        await this.adminAuthService.logout(refreshToken);
      }

      // Clear refresh token cookie
      this.clearRefreshTokenCookie(res);

      this.logger.log(`Admin logout successful for: ${req.admin.username}`);
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error(`Admin logout failed: ${error.message}`);
      // Still clear the cookie even if logout fails
      this.clearRefreshTokenCookie(res);
      return { success: true, message: 'Logged out locally' };
    }
  }

  @Get('users')
  @UseGuards(AdminJwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUsers(
    @Query() query: AdminUserListQueryDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    try {
      this.logger.log(`Admin ${req.admin.username} requesting user list`);
      return await this.adminUserService.getUserList(query);
    } catch (error) {
      this.logger.error(`Failed to get users: ${error.message}`);
      throw error;
    }
  }

  @Get('users/:userId')
  @UseGuards(AdminJwtAuthGuard)
  async getUserDetails(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    try {
      this.logger.log(`Admin ${req.admin.username} requesting user details for: ${userId}`);
      
      const user = await this.adminUserService.getUserDetails(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      return { success: true, data: user };
    } catch (error) {
      this.logger.error(`Failed to get user details: ${error.message}`);
      throw error;
    }
  }

  @Get('stats')
  @UseGuards(AdminJwtAuthGuard)
  async getStats(@Req() req: AuthenticatedAdminRequest) {
    try {
      this.logger.log(`Admin ${req.admin.username} requesting stats`);
      return await this.adminUserService.getStats();
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw error;
    }
  }

  @Get('users/export')
  @UseGuards(AdminJwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async exportUsers(
    @Query() query: AdminUserListQueryDto,
    @Req() req: AuthenticatedAdminRequest,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Admin ${req.admin.username} exporting users`);

      // Get all users matching the query (without pagination for export)
      const exportQuery = { ...query, limit: 10000, page: 1 }; // Large limit for export
      const userList = await this.adminUserService.getUserList(exportQuery);

      // Generate CSV content
      const csvHeader = 'Handle,Phone,Subscription Status,Trial Expires,Created At,Follower Count,Verified\n';
      const csvRows = userList.users.map(user => {
        const trialExpires = user.trialExpiresAt ? new Date(user.trialExpiresAt).toLocaleDateString() : 'N/A';
        const createdAt = new Date(user.createdAt).toLocaleDateString();
        return `"${user.handle}","${user.phoneNumber || 'N/A'}","${user.subscriptionStatus}","${trialExpires}","${createdAt}","${user.followerCount || 0}","${user.isVerified ? 'Yes' : 'No'}"`;
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      // Set response headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`);

      return res.send(csvContent);
    } catch (error) {
      this.logger.error(`Failed to export users: ${error.message}`);
      throw error;
    }
  }

  @Post('cleanup')
  @UseGuards(AdminJwtAuthGuard)
  async manualCleanup(@Req() req: AuthenticatedAdminRequest) {
    try {
      this.logger.log(`Admin ${req.admin.username} initiated manual cleanup`);
      const result = await this.adminCleanupService.manualCleanup();
      return {
        success: true,
        message: `Cleanup completed: ${result.deletedCount} sessions deleted`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Manual cleanup failed: ${error.message}`);
      throw error;
    }
  }

  @Get('sessions/stats')
  @UseGuards(AdminJwtAuthGuard)
  async getSessionStats(@Req() req: AuthenticatedAdminRequest) {
    try {
      this.logger.log(`Admin ${req.admin.username} requesting session stats`);
      const stats = await this.adminCleanupService.getSessionStats();
      return { success: true, data: stats };
    } catch (error) {
      this.logger.error(`Failed to get session stats: ${error.message}`);
      throw error;
    }
  }

  @Get('health')
  @AdminPublic()
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'admin-api',
    };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    res.cookie(this.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: this.isProduction, // Only send over HTTPS in production
      sameSite: 'strict',
      maxAge,
      path: '/admin', // Restrict cookie to admin routes
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/admin',
    });
  }
}
