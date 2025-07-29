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
}
