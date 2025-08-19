import { Controller, Post, Get, Body, Param, Query, Request, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IngestionCoordinatorService } from '../services/ingestion-coordinator.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { OnboardingService } from '../services/onboarding.service';
import { Public } from '../../auth/guards/jwt-auth.guard';

export class OnDemandIngestionDto {
  handle: string;
}

export class EnableShortPollingDto {
  handle: string;
  priority?: 'high' | 'medium';
}

export class OnboardingStartDto {
  handle: string;
  planType: 'free' | 'paid';
}

export class OnboardingSelectDto {
  handle: string;
  sessionId: string;
  selectedVideoIds: string[];
}

@ApiTags('Ingestion Coordinator')
@Controller('ingestion')
export class IngestionCoordinatorController {
  constructor(
    private readonly coordinatorService: IngestionCoordinatorService,
    private readonly usageService: UsageTrackingService,
    private readonly onboardingService: OnboardingService,
  ) {}

  @Post('sync-now')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request immediate ingestion for authenticated seller' })
  @ApiResponse({ status: 200, description: 'Ingestion request queued successfully' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 403, description: 'Quota exceeded' })
  async syncNow(@Request() req: any) {
    // Debug: Log the entire user object to see what we're getting
    console.log('DEBUG: req.user =', JSON.stringify(req.user, null, 2));
    console.log('DEBUG: req.user?.handle =', req.user?.handle);

    const handle = req.user?.handle;

    if (!handle) {
      throw new HttpException('No shop handle found for authenticated user', HttpStatus.BAD_REQUEST);
    }

    // Check if user can make on-demand request
    const canRequest = await this.usageService.canMakeOnDemandRequest(handle);
    if (!canRequest.allowed) {
      throw new HttpException(canRequest.reason, HttpStatus.FORBIDDEN);
    }

    // Record the request
    await this.usageService.recordOnDemandRequest(handle);

    // Queue the ingestion
    const result = await this.coordinatorService.requestOnDemandIngestion(handle, req.user?.id);

    if (!result.queued) {
      throw new HttpException(result.error || 'Failed to queue ingestion', HttpStatus.TOO_MANY_REQUESTS);
    }

    return {
      success: true,
      message: 'Ingestion queued successfully',
      position: result.position,
      estimatedWaitTime: `${result.position * 2} minutes`, // Rough estimate
    };
  }

  @Post('admin/sync-seller')
  @Public()
  @ApiOperation({ summary: 'Admin endpoint to sync specific seller' })
  @ApiResponse({ status: 200, description: 'Ingestion request queued successfully' })
  async adminSyncSeller(@Body() body: OnDemandIngestionDto) {
    // TODO: Add admin authentication guard
    const result = await this.coordinatorService.requestOnDemandIngestion(body.handle, 'admin');

    if (!result.queued) {
      throw new HttpException(result.error || 'Failed to queue ingestion', HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      message: 'Ingestion queued successfully',
      position: result.position,
    };
  }

  @Post('admin/enable-short-polling')
  @Public()
  @ApiOperation({ summary: 'Admin endpoint to enable short polling for seller' })
  @ApiResponse({ status: 200, description: 'Short polling enabled successfully' })
  async enableShortPolling(@Body() body: EnableShortPollingDto) {
    // TODO: Add admin authentication guard
    const success = await this.coordinatorService.enableShortPolling(body.handle, body.priority || 'medium');

    if (!success) {
      throw new HttpException('Failed to enable short polling', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Update usage tracking
    await this.usageService.setShortPolling(body.handle, true);

    return {
      success: true,
      message: 'Short polling enabled successfully',
    };
  }

  @Post('admin/disable-short-polling/:handle')
  @Public()
  @ApiOperation({ summary: 'Admin endpoint to disable short polling for seller' })
  @ApiResponse({ status: 200, description: 'Short polling disabled successfully' })
  async disableShortPolling(@Param('handle') handle: string) {
    // TODO: Add admin authentication guard
    const success = await this.coordinatorService.disableShortPolling(handle);

    if (!success) {
      throw new HttpException('Failed to disable short polling', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Update usage tracking
    await this.usageService.setShortPolling(handle, false);

    return {
      success: true,
      message: 'Short polling disabled successfully',
    };
  }

  @Get('queue-status')
  @Public()
  @ApiOperation({ summary: 'Get current ingestion queue status' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved successfully' })
  async getQueueStatus() {
    const status = this.coordinatorService.getQueueStatus();
    return {
      success: true,
      data: status,
    };
  }

  @Get('usage/:handle')
  @Public()
  @ApiOperation({ summary: 'Get usage statistics for a seller' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getSellerUsage(@Param('handle') handle: string, @Query('planType') planType: 'free' | 'paid' = 'free') {
    const usage = await this.usageService.getSellerUsage(handle, planType);
    return {
      success: true,
      data: usage,
    };
  }

  @Post('usage/:handle/upgrade')
  @Public()
  @ApiOperation({ summary: 'Upgrade seller to paid plan' })
  @ApiResponse({ status: 200, description: 'Plan upgraded successfully' })
  async upgradeToPaid(@Param('handle') handle: string) {
    await this.usageService.updateSellerPlan(handle, 'paid');
    
    // Enable short polling for paid users
    await this.coordinatorService.enableShortPolling(handle, 'high');
    await this.usageService.setShortPolling(handle, true);

    return {
      success: true,
      message: 'Plan upgraded to paid successfully',
    };
  }

  @Post('onboard/start')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start onboarding session to scrape old videos' })
  @ApiResponse({ status: 200, description: 'Onboarding session started successfully' })
  async startOnboarding(@Request() req: any, @Body() body: { planType?: 'free' | 'paid' }) {
    const handle = req.user?.handle;

    if (!handle) {
      throw new HttpException('No shop handle found for authenticated user', HttpStatus.BAD_REQUEST);
    }

    const planType = body.planType || 'free';
    const result = await this.onboardingService.startOnboardingSession(handle, planType);

    if (!result.success) {
      throw new HttpException(result.error || 'Failed to start onboarding', HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      data: {
        sessionId: result.sessionId,
        candidates: result.candidates,
        limits: this.onboardingService.getOnboardingLimits(planType),
      },
    };
  }

  @Post('onboard/select')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process selected videos from onboarding session' })
  @ApiResponse({ status: 200, description: 'Selected videos processed successfully' })
  async processSelectedVideos(@Request() req: any, @Body() body: OnboardingSelectDto) {
    const handle = req.user?.handle;
    
    if (!handle || handle !== body.handle) {
      throw new HttpException('Unauthorized to process videos for this handle', HttpStatus.FORBIDDEN);
    }

    const result = await this.onboardingService.processSelectedVideos(
      body.handle,
      body.sessionId,
      body.selectedVideoIds
    );

    if (!result.success) {
      throw new HttpException(result.error || 'Failed to process selected videos', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return {
      success: true,
      data: {
        processedCount: result.processedCount,
        message: `Successfully queued ${result.processedCount} videos for processing`,
      },
    };
  }

  @Get('onboard/limits/:planType')
  @Public()
  @ApiOperation({ summary: 'Get onboarding limits for plan type' })
  @ApiResponse({ status: 200, description: 'Onboarding limits retrieved successfully' })
  async getOnboardingLimits(@Param('planType') planType: 'free' | 'paid') {
    const limits = this.onboardingService.getOnboardingLimits(planType);
    return {
      success: true,
      data: limits,
    };
  }
}
