import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Post,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard, RequireTrialOrActive } from '../auth/guards/subscription.guard';
import { UserRepository } from '../users/repository/user.repository';
import { ShopService } from './services/shop.service';
import { AnalyticsService } from './services/analytics.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('Shop')
@Controller('shop')
export class ShopController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly shopService: ShopService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get(':handle')
  @ApiOperation({
    summary: 'Get shop by handle (Public)',
    description: 'Publicly accessible endpoint to retrieve shop information for a given TikTok handle.',
  })
  @ApiParam({
    name: 'handle',
    description: 'TikTok handle',
    example: 'johndoe123',
  })
  @ApiResponse({
    status: 200,
    description: 'Shop information retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Shop not found',
  })
  async getShopByHandlePublic(
    @Param('handle') handle: string,
  ): Promise<ApiResponseDto<any>> {
    // Try to get shop from Shops table first
    const shop = await this.shopService.getShopByHandle(handle);

    if (shop) {
      // Get view count from analytics
      const viewCount = await this.analyticsService.getShopViewCount(shop.handle);

      // Return shop data from Shops table (publicly accessible)
      return ApiResponseDto.success(
        {
          shopId: shop.user_id,
          handle: shop.handle,
          shopLink: shop.shop_link,
          displayName: shop.display_name,
          profilePhotoUrl: shop.profile_photo_url,
          followerCount: shop.follower_count,
          isVerified: shop.is_verified,
          subscriptionStatus: shop.subscription_status,
          createdAt: shop.created_at,
          productCount: 0, // TODO: Get actual product count from products table
          viewCount: viewCount,
        },
        'Shop information retrieved successfully'
      );
    }

    // Fallback to user table if not found in Shops table
    const user = await this.userRepository.getUserByHandle(handle);

    if (!user) {
      return ApiResponseDto.error('Shop not found', 'SHOP_NOT_FOUND');
    }

    // Get view count from analytics
    const viewCount = await this.analyticsService.getShopViewCount(user.handle);

    // Return basic shop info from user table (publicly accessible)
    return ApiResponseDto.success(
      {
        shopId: user.userId,
        handle: user.handle,
        shopLink: user.shopLink,
        displayName: user.displayName,
        profilePhotoUrl: user.profilePhotoUrl,
        followerCount: user.followerCount,
        isVerified: user.isVerified,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        productCount: 0, // TODO: Get actual product count from products table
        viewCount: viewCount,
      },
      'Shop information retrieved successfully'
    );
  }

  @Get(':handle/owner')
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequireTrialOrActive()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get shop by handle (Owner)',
    description: 'Authenticated endpoint for shop owners to get detailed shop information.',
  })
  @ApiParam({
    name: 'handle',
    description: 'TikTok handle',
    example: 'johndoe123',
  })
  @ApiResponse({
    status: 200,
    description: 'Shop information retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not shop owner',
  })
  async getShopByHandleOwner(
    @Param('handle') handle: string,
    @Request() req: any,
  ): Promise<ApiResponseDto<any>> {
    const requestingUser = req.user;

    // Check if the requesting user owns this shop
    if (requestingUser.handle !== handle) {
      return ApiResponseDto.error('Access denied - you can only view your own shop details', 'ACCESS_DENIED');
    }

    // Get detailed shop information for owner
    const shop = await this.shopService.getShopByHandle(handle);

    if (shop) {
      // Get detailed analytics for owner
      const analytics = await this.analyticsService.getShopAnalytics(shop.handle);

      return ApiResponseDto.success(
        {
          shopId: shop.user_id,
          handle: shop.handle,
          shopLink: shop.shop_link,
          displayName: shop.display_name,
          profilePhotoUrl: shop.profile_photo_url,
          followerCount: shop.follower_count,
          isVerified: shop.is_verified,
          subscriptionStatus: shop.subscription_status,
          createdAt: shop.created_at,
          productCount: 0, // TODO: Get actual product count from products table
          viewCount: analytics.total_views,
          // Additional owner-only data
          phone: shop.phone,
          updatedAt: shop.updated_at,
          analytics: {
            total_views: analytics.total_views,
            views_today: analytics.views_today,
            views_this_week: analytics.views_this_week,
            views_this_month: analytics.views_this_month,
            recent_views: analytics.recent_views.slice(0, 5), // Last 5 views
          },
        },
        'Shop information retrieved successfully'
      );
    }

    // Fallback to user table
    const user = await this.userRepository.getUserByHandle(handle);

    if (!user) {
      return ApiResponseDto.error('Shop not found', 'SHOP_NOT_FOUND');
    }

    return ApiResponseDto.success(
      {
        shopId: user.userId,
        handle: user.handle,
        shopLink: user.shopLink,
        displayName: user.displayName,
        profilePhotoUrl: user.profilePhotoUrl,
        followerCount: user.followerCount,
        isVerified: user.isVerified,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        productCount: 0, // TODO: Get actual product count
        viewCount: Math.floor(Math.random() * 100) + 10, // TODO: Get actual view count
        // Additional owner-only data
        phoneNumber: user.phoneNumber,
        updatedAt: user.updatedAt,
      },
      'Shop information retrieved successfully'
    );
  }

  @Post(':handle/view')
  @ApiOperation({
    summary: 'Track shop view',
    description: 'Public endpoint to track when someone views a shop.',
  })
  @ApiParam({
    name: 'handle',
    description: 'TikTok handle',
    example: 'johndoe123',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        referrer: { type: 'string', description: 'Where the visitor came from' },
        userAgent: { type: 'string', description: 'Browser user agent' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'View tracked successfully',
  })
  async trackShopView(
    @Param('handle') handle: string,
    @Body() trackingData: { referrer?: string; userAgent?: string },
  ): Promise<ApiResponseDto<any>> {
    // Track the view in analytics
    await this.analyticsService.trackShopView(handle, {
      referrer: trackingData.referrer,
      userAgent: trackingData.userAgent,
    });

    return ApiResponseDto.success(
      { tracked: true, handle },
      'View tracked successfully'
    );
  }

  @Get(':handle/analytics')
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @RequireTrialOrActive()
  @ApiOperation({
    summary: 'Get shop analytics',
    description: 'Retrieves analytics data for a shop. Requires active subscription or trial.',
  })
  @ApiParam({
    name: 'handle',
    description: 'TikTok handle',
    example: 'johndoe123',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics data retrieved successfully',
  })
  @ApiResponse({
    status: 402,
    description: 'Subscription required',
  })
  async getShopAnalytics(
    @Param('handle') handle: string,
    @Request() req: any,
  ): Promise<ApiResponseDto<any>> {
    const user = await this.userRepository.getUserByHandle(handle);
    
    if (!user) {
      return ApiResponseDto.error('Shop not found', 'SHOP_NOT_FOUND');
    }

    // Check if the requesting user owns this shop
    const requestingUser = req.user;
    if (requestingUser.handle !== handle) {
      return ApiResponseDto.error('Access denied', 'ACCESS_DENIED');
    }

    // Mock analytics data - in real implementation, this would come from analytics service
    const analyticsData = {
      totalViews: 12500,
      totalClicks: 850,
      conversionRate: 6.8,
      topProducts: [
        { id: '1', name: 'Product A', clicks: 320 },
        { id: '2', name: 'Product B', clicks: 280 },
        { id: '3', name: 'Product C', clicks: 250 },
      ],
      recentActivity: [
        { date: '2024-01-15', views: 450, clicks: 32 },
        { date: '2024-01-14', views: 380, clicks: 28 },
        { date: '2024-01-13', views: 520, clicks: 41 },
      ],
      subscriptionStatus: user.subscriptionStatus,
    };

    return ApiResponseDto.success(
      analyticsData,
      'Analytics data retrieved successfully'
    );
  }

  @Get(':handle/settings')
  @RequireTrialOrActive()
  @ApiOperation({
    summary: 'Get shop settings',
    description: 'Retrieves shop settings. Requires active subscription or trial.',
  })
  @ApiParam({
    name: 'handle',
    description: 'TikTok handle',
    example: 'johndoe123',
  })
  @ApiResponse({
    status: 200,
    description: 'Shop settings retrieved successfully',
  })
  @ApiResponse({
    status: 402,
    description: 'Subscription required',
  })
  async getShopSettings(
    @Param('handle') handle: string,
    @Request() req: any,
  ): Promise<ApiResponseDto<any>> {
    const user = await this.userRepository.getUserByHandle(handle);
    
    if (!user) {
      return ApiResponseDto.error('Shop not found', 'SHOP_NOT_FOUND');
    }

    // Check if the requesting user owns this shop
    const requestingUser = req.user;
    if (requestingUser.handle !== handle) {
      return ApiResponseDto.error('Access denied', 'ACCESS_DENIED');
    }

    // Mock settings data
    const settingsData = {
      shopId: user.userId,
      handle: user.handle,
      displayName: user.displayName,
      profilePhotoUrl: user.profilePhotoUrl,
      subscriptionStatus: user.subscriptionStatus,
      trialEndDate: user.trialEndDate,
      subscriptionEndDate: user.subscriptionEndDate,
      settings: {
        enableAnalytics: true,
        enableNotifications: true,
        publicProfile: true,
        allowComments: true,
        theme: 'default',
        customDomain: null,
      },
      limits: {
        maxProducts: user.subscriptionStatus === 'active' ? 100 : 10,
        maxImages: user.subscriptionStatus === 'active' ? 1000 : 50,
        analyticsRetention: user.subscriptionStatus === 'active' ? 365 : 30,
      },
    };

    return ApiResponseDto.success(
      settingsData,
      'Shop settings retrieved successfully'
    );
  }
}
