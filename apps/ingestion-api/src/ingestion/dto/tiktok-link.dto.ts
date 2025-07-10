import { IsUrl, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TikTokLinkDto {
  @ApiProperty({
    description: 'TikTok video URL',
    example: 'https://www.tiktok.com/@username/video/1234567890123456789'
  })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @IsNotEmpty({ message: 'URL is required' })
  url: string;

  @ApiProperty({
    description: 'User ID who submitted the link',
    example: 'user_123',
    required: false
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Additional metadata or tags',
    example: 'fashion, trending',
    required: false
  })
  @IsOptional()
  @IsString()
  tags?: string;
}
