import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
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
  ValidateHandleDto,
  SignupDto,
  VerifySignupDto,
  SigninDto,
  VerifySigninDto,
  RefreshTokenDto,
  HandleValidationResponseDto,
  AuthResponseDto,
  OtpResponseDto,
} from '../dto/auth.dto';
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
  @ApiBody({ type: ValidateHandleDto })
  @ApiResponse({
    status: 200,
    description: 'Handle validation result',
    type: ApiResponseDto<HandleValidationResponseDto>,
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
    @Body() validateHandleDto: ValidateHandleDto,
  ): Promise<ApiResponseDto<HandleValidationResponseDto>> {
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

  @Post('signup')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate signup process',
    description: 'Validates handle and sends OTP to phone number for signup',
  })
  @ApiBody({ type: SignupDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: ApiResponseDto<OtpResponseDto>,
  })
  @ApiResponse({
    status: 409,
    description: 'Handle or phone number already exists',
  })
  async signup(@Body() signupDto: SignupDto): Promise<ApiResponseDto<OtpResponseDto>> {
    const session = await this.authService.initiateSignup(
      signupDto.handle,
      signupDto.phoneNumber,
    );

    return ApiResponseDto.success(
      {
        message: 'OTP sent to your phone number',
        session: session.session,
        codeDelivery: {
          deliveryMedium: 'SMS',
          destination: this.maskPhoneNumber(signupDto.phoneNumber),
        },
      },
      'Signup initiated successfully'
    );
  }

  @Post('verify-signup')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Verify signup OTP',
    description: 'Verifies OTP code and completes user registration',
  })
  @ApiBody({ type: VerifySignupDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: ApiResponseDto<AuthResponseDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP code',
  })
  async verifySignup(
    @Body() verifySignupDto: VerifySignupDto,
  ): Promise<ApiResponseDto<AuthResponseDto>> {
    const authResult = await this.authService.confirmSignup(
      verifySignupDto.handle,
      verifySignupDto.phoneNumber,
      verifySignupDto.code,
    );

    // Get user data
    const user = await this.userRepository.getUserByPhone(verifySignupDto.phoneNumber);
    if (!user) {
      throw new Error('User not found after registration');
    }

    return ApiResponseDto.success(
      {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        expiresIn: authResult.expiresIn,
        user: {
          userId: user.userId,
          handle: user.handle,
          phoneNumber: user.phoneNumber,
          shopLink: user.shopLink,
          subscriptionStatus: user.subscriptionStatus,
          createdAt: user.createdAt,
        },
      },
      'User registered successfully'
    );
  }

  @Post('signin')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate signin process',
    description: 'Sends OTP to registered phone number for signin',
  })
  @ApiBody({ type: SigninDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: ApiResponseDto<OtpResponseDto>,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async signin(@Body() signinDto: SigninDto): Promise<ApiResponseDto<OtpResponseDto>> {
    const session = await this.authService.initiateSignin(signinDto.phoneNumber);

    return ApiResponseDto.success(
      {
        message: 'OTP sent to your phone number',
        session: session.session,
        codeDelivery: {
          deliveryMedium: 'SMS',
          destination: this.maskPhoneNumber(signinDto.phoneNumber),
        },
      },
      'Signin initiated successfully'
    );
  }

  @Post('verify-signin')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify signin OTP',
    description: 'Verifies OTP code and completes user signin',
  })
  @ApiBody({ type: VerifySigninDto })
  @ApiResponse({
    status: 200,
    description: 'User signed in successfully',
    type: ApiResponseDto<AuthResponseDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP code',
  })
  async verifySignin(
    @Body() verifySigninDto: VerifySigninDto,
  ): Promise<ApiResponseDto<AuthResponseDto>> {
    const authResult = await this.authService.confirmSignin(
      verifySigninDto.phoneNumber,
      verifySigninDto.code,
    );

    // Get user data
    const user = await this.userRepository.getUserByPhone(verifySigninDto.phoneNumber);
    if (!user) {
      throw new Error('User not found');
    }

    return ApiResponseDto.success(
      {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        expiresIn: authResult.expiresIn,
        user: {
          userId: user.userId,
          handle: user.handle,
          phoneNumber: user.phoneNumber,
          shopLink: user.shopLink,
          subscriptionStatus: user.subscriptionStatus,
          createdAt: user.createdAt,
        },
      },
      'User signed in successfully'
    );
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Refreshes access token using refresh token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: ApiResponseDto<AuthResponseDto>,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<ApiResponseDto<Partial<AuthResponseDto>>> {
    const authResult = await this.authService.refreshTokens(refreshTokenDto.refreshToken);

    return ApiResponseDto.success(
      {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        expiresIn: authResult.expiresIn,
      },
      'Token refreshed successfully'
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Gets the authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getProfile(@Request() req: any): Promise<ApiResponseDto<any>> {
    const user = await this.userRepository.getUserById(req.user.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return ApiResponseDto.success(
      {
        userId: user.userId,
        handle: user.handle,
        phoneNumber: user.phoneNumber,
        shopLink: user.shopLink,
        subscriptionStatus: user.subscriptionStatus,
        profilePhotoUrl: user.profilePhotoUrl,
        displayName: user.displayName,
        followerCount: user.followerCount,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      'Profile retrieved successfully'
    );
  }

  @Post('signout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign out user',
    description: 'Signs out the user and revokes tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'User signed out successfully',
  })
  async signout(@Request() req: any): Promise<ApiResponseDto<null>> {
    await this.authService.revokeToken(req.token);

    return ApiResponseDto.success(null, 'User signed out successfully');
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }
    const visiblePart = phoneNumber.slice(-4);
    const maskedPart = '*'.repeat(phoneNumber.length - 4);
    return maskedPart + visiblePart;
  }
}
