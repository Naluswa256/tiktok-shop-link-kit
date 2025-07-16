import { IsString, IsPhoneNumber, IsNotEmpty, Length, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateHandleDto {
  @ApiProperty({
    description: 'TikTok handle without @ symbol',
    example: 'johndoe123',
    minLength: 2,
    maxLength: 24,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 24)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Handle can only contain letters, numbers, dots, and underscores',
  })
  handle: string;
}

export class SignupDto {
  @ApiProperty({
    description: 'TikTok handle without @ symbol',
    example: 'johndoe123',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 24)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Handle can only contain letters, numbers, dots, and underscores',
  })
  handle: string;

  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+1234567890',
  })
  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNumber: string;
}

export class VerifySignupDto {
  @ApiProperty({
    description: 'TikTok handle without @ symbol',
    example: 'johndoe123',
  })
  @IsString()
  @IsNotEmpty()
  handle: string;

  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+1234567890',
  })
  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'OTP code received via SMS',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}

export class SigninDto {
  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+1234567890',
  })
  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNumber: string;
}

export class VerifySigninDto {
  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+1234567890',
  })
  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'OTP code received via SMS',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

// Response DTOs
export class HandleValidationResponseDto {
  @ApiProperty({ description: 'Whether the handle exists' })
  exists: boolean;

  @ApiProperty({ description: 'Profile photo URL if available', required: false })
  profilePhotoUrl?: string;

  @ApiProperty({ description: 'Follower count if available', required: false })
  followerCount?: number;

  @ApiProperty({ description: 'Whether the account is verified', required: false })
  isVerified?: boolean;

  @ApiProperty({ description: 'Display name if available', required: false })
  displayName?: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Access token' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Token expiration time in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'User information' })
  user: {
    userId: string;
    handle: string;
    phoneNumber: string;
    shopLink: string;
    subscriptionStatus: string;
    createdAt: string;
  };
}

export class OtpResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'Session identifier for verification' })
  session: string;

  @ApiProperty({ description: 'Code delivery details', required: false })
  codeDelivery?: {
    deliveryMedium: string;
    destination: string;
  };
}
