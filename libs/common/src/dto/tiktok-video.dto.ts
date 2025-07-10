import { IsString, IsNotEmpty, IsOptional, IsArray, IsUrl, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class TikTokVideoDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  caption: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @Type(() => Date)
  createdAt?: Date;

  @IsOptional()
  @Type(() => Date)
  updatedAt?: Date;
}

export class TikTokVideoMetadataDto {
  @IsString()
  @IsNotEmpty()
  videoId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  duration?: number;

  @IsOptional()
  viewCount?: number;

  @IsOptional()
  likeCount?: number;

  @IsOptional()
  shareCount?: number;

  @IsOptional()
  commentCount?: number;
}
