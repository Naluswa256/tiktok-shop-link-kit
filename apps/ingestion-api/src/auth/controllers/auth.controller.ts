import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../../users/repository/user.repository';
import { Public } from '../guards/jwt-auth.guard';
import {
  SignupDto as PasswordSignupDto,
  SigninDto as PasswordSigninDto,
  SignupResponseDto,
  SigninResponseDto,
  ValidateHandleDto as PasswordValidateHandleDto,
  HandleValidationResponseDto as PasswordHandleValidationResponseDto,
  RefreshTokenDto,
} from '../dto/password-auth.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
  ) {}

  @Post('validate-handle')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate TikTok handle',
    description: 'Validates if a TikTok handle exists and is available for registration',
  })
  @ApiBody({ type: PasswordValidateHandleDto })
  @ApiResponse({
    status: 200,
    description: 'Handle validation result',
    type: ApiResponseDto<PasswordHandleValidationResponseDto>,
  })
  @ApiResponse({
    status: 404,
    description: 'Handle not found on TikTok',
  })
  @ApiResponse({
    status: 409,
    description: 'Handle already registered',
  })
  async validateHandle(
    @Body() validateHandleDto: PasswordValidateHandleDto,
  ): Promise<ApiResponseDto<PasswordHandleValidationResponseDto>> {
    const result = await this.authService.validateHandle(validateHandleDto.handle);
    
    return ApiResponseDto.success(
      {
        exists: result.exists,
        profilePhotoUrl: result.profilePhotoUrl,
        followerCount: result.followerCount,
        isVerified: result.isVerified,
        displayName: result.displayName,
      },
      'Handle validation successful'
    );
  }

  // ===== PASSWORD-BASED AUTHENTICATION ENDPOINTS =====

  @Post('password/signup')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Password-based signup',
    description: 'Creates a new user account with TikTok handle and password',
  })
  @ApiBody({ type: PasswordSignupDto })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully',
    type: ApiResponseDto<SignupResponseDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or password too weak',
  })
  @ApiResponse({
    status: 404,
    description: 'TikTok handle not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Handle already taken',
  })
  async passwordSignup(
    @Body() signupDto: PasswordSignupDto,
  ): Promise<ApiResponseDto<SignupResponseDto>> {
    const result = await this.authService.signup(signupDto.handle, signupDto.password);
    
    return ApiResponseDto.success(
      result,
      'Account created successfully! Your shop is ready.'
    );
  }

  @Post('password/signin')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Password-based signin',
    description: 'Authenticates user with TikTok handle and password',
  })
  @ApiBody({ type: PasswordSigninDto })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: ApiResponseDto<SigninResponseDto>,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async passwordSignin(
    @Body() signinDto: PasswordSigninDto,
  ): Promise<ApiResponseDto<SigninResponseDto>> {
    const result = await this.authService.signin(signinDto.handle, signinDto.password);
    
    return ApiResponseDto.success(
      result,
      'Authentication successful'
    );
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Uses refresh token to get a new access token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: ApiResponseDto<any>,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<ApiResponseDto<any>> {
    const authResult = await this.authService.refreshTokens(refreshTokenDto.refreshToken);

    return ApiResponseDto.success(
      {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        idToken: authResult.idToken,
        expiresIn: authResult.expiresIn,
        tokenType: authResult.tokenType,
      },
      'Token refreshed successfully'
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  async getCurrentUser(@Request() req: any): Promise<ApiResponseDto<any>> {
    const user = req.user;
    
    return ApiResponseDto.success(
      {
        userId: user.userId,
        handle: user.handle,
        phoneNumber: user.phoneNumber,
        subscriptionStatus: user.subscriptionStatus,
      },
      'User profile retrieved successfully'
    );
  }

  @Post('signout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign out user',
    description: 'Revokes the current access token and signs out the user',
  })
  @ApiResponse({
    status: 200,
    description: 'User signed out successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  async signout(@Request() req: any): Promise<ApiResponseDto<null>> {
    await this.authService.revokeToken(req.token);

    return ApiResponseDto.success(null, 'User signed out successfully');
  }

  @Get('subscription-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get subscription status',
    description: 'Retrieve current subscription status and expiry information',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription status retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  async getSubscriptionStatus(@Request() req: any): Promise<ApiResponseDto<any>> {
    const user = req.user;

    // Get fresh user data
    const currentUser = await this.userRepository.getUserById(user.userId);
    if (!currentUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Calculate days left
    let daysLeft = null;
    if (currentUser.trialEndDate || currentUser.subscriptionEndDate) {
      const expiryDate = new Date(currentUser.trialEndDate || currentUser.subscriptionEndDate);
      const now = new Date();
      const diffMs = expiryDate.getTime() - now.getTime();
      daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return ApiResponseDto.success(
      {
        status: currentUser.subscriptionStatus,
        expiresAt: currentUser.trialEndDate || currentUser.subscriptionEndDate,
        daysLeft,
      },
      'Subscription status retrieved successfully'
    );
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Subscribe to premium plan',
    description: 'Initiate subscription to premium plan (UGX 10,000/month)',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription activated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  async subscribe(@Request() req: any): Promise<ApiResponseDto<any>> {
    const user = req.user;

    // For now, we'll simulate successful payment and activate subscription
    // In production, this would integrate with a payment processor

    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // 1 month from now

    await this.userRepository.updateUser(user.userId, {
      subscriptionStatus: 'active' as any,
      subscriptionEndDate: subscriptionEndDate.toISOString(),
      trialEndDate: null, // Clear trial end date
    });

    return ApiResponseDto.success(
      {
        status: 'paid',
        expiresAt: subscriptionEndDate.toISOString(),
        daysLeft: 30,
      },
      'Subscription activated successfully'
    );
  }
}
