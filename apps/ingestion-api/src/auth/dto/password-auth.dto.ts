import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({
    description: 'TikTok handle (without @)',
    example: 'nalu-fashion',
    pattern: '^[a-zA-Z0-9._-]+$',
    minLength: 2,
    maxLength: 24,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Handle must be at least 2 characters long' })
  @MaxLength(24, { message: 'Handle must be at most 24 characters long' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Handle can only contain letters, numbers, dots, underscores, and hyphens',
  })
  handle: string;

  @ApiProperty({
    description: 'Password for the account',
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  password: string;
}

export class SigninDto {
  @ApiProperty({
    description: 'TikTok handle (without @)',
    example: 'nalu-fashion',
  })
  @IsString()
  @IsNotEmpty()
  handle: string;

  @ApiProperty({
    description: 'Password for the account',
    example: 'SecurePass123!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token to get new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ValidateHandleDto {
  @ApiProperty({
    description: 'TikTok handle to validate (without @)',
    example: 'nalu-fashion',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Handle can only contain letters, numbers, dots, underscores, and hyphens',
  })
  handle: string;
}

export class SignupResponseDto {
  @ApiProperty({ description: 'Whether the signup was successful' })
  success: boolean;

  @ApiProperty({ description: 'Generated shop link for the user', example: '/shop/nalu-fashion' })
  shopLink: string;

  @ApiProperty({ description: 'Success message' })
  message: string;
}

export class SigninResponseDto {
  @ApiProperty({ description: 'Whether the signin was successful' })
  success: boolean;

  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'JWT ID token' })
  idToken: string;

  @ApiProperty({ description: 'Token expiration time in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'User information' })
  user: {
    handle: string;
    userId: string;
    subscriptionStatus: string;
  };
}

export class HandleValidationResponseDto {
  @ApiProperty({ description: 'Whether the TikTok handle exists' })
  exists: boolean;

  @ApiProperty({ description: 'Profile photo URL', required: false })
  profilePhotoUrl?: string;

  @ApiProperty({ description: 'Follower count', required: false })
  followerCount?: number;

  @ApiProperty({ description: 'Whether the account is verified', required: false })
  isVerified?: boolean;

  @ApiProperty({ description: 'Display name', required: false })
  displayName?: string;

  @ApiProperty({ description: 'Error message if validation failed', required: false })
  error?: string;
}
