import { IsOptional, IsString, IsInt, Min, Max, IsISO8601, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GetShopProductsDto {
  @ApiProperty({
    description: 'Seller handle (TikTok username)',
    example: 'nalu-fashion',
    pattern: '^[a-zA-Z0-9._-]+$',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Seller handle must contain only letters, numbers, dots, underscores, and hyphens',
  })
  handle: string;

  @ApiProperty({
    description: 'Number of products to return',
    example: 20,
    minimum: 1,
    maximum: 50,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(50, { message: 'Limit cannot exceed 50' })
  limit?: number = 20;

  @ApiProperty({
    description: 'Pagination key for next page (URL-encoded JSON)',
    example: '%7B%22seller_handle%22%3A%22nalu-fashion%22%2C%22video_id%22%3A%22abc123%22%7D',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (!value) return undefined;
    try {
      // Validate that it can be decoded and parsed
      const decoded = decodeURIComponent(value);
      JSON.parse(decoded);
      return value;
    } catch (error) {
      throw new Error('Invalid lastKey format. Must be URL-encoded JSON.');
    }
  })
  lastKey?: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp to get products created after this time',
    example: '2024-01-15T10:30:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsISO8601({}, { message: 'Since must be a valid ISO 8601 timestamp' })
  since?: string;
}

export class GetProductDto {
  @ApiProperty({
    description: 'Seller handle (TikTok username)',
    example: 'nalu-fashion',
    pattern: '^[a-zA-Z0-9._-]+$',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Seller handle must contain only letters, numbers, dots, underscores, and hyphens',
  })
  handle: string;

  @ApiProperty({
    description: 'Video ID',
    example: 'abc123def456',
    pattern: '^[a-zA-Z0-9_-]+$',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Video ID must contain only letters, numbers, underscores, and hyphens',
  })
  videoId: string;
}
