import { ApiProperty } from '@nestjs/swagger';

export class ThumbnailInfoDto {
  @ApiProperty({
    description: 'S3 URL of the thumbnail',
    example: 'https://s3.amazonaws.com/bucket/thumbnails/abc123_1.jpg',
  })
  thumbnail_url: string;

  @ApiProperty({
    description: 'S3 key of the thumbnail',
    example: 'thumbnails/nalu-fashion/abc123_1.jpg',
  })
  thumbnail_s3_key: string;

  @ApiProperty({
    description: 'Timestamp of the frame in seconds',
    example: 15.5,
  })
  frame_timestamp: number;

  @ApiProperty({
    description: 'Frame index in the video',
    example: 465,
  })
  frame_index: number;

  @ApiProperty({
    description: 'AI confidence score for this thumbnail',
    example: 0.95,
  })
  confidence_score: number;

  @ApiProperty({
    description: 'Quality score of the thumbnail',
    example: 0.88,
  })
  quality_score: number;

  @ApiProperty({
    description: 'Whether this is the primary thumbnail',
    example: true,
  })
  is_primary: boolean;
}

export class ProcessingMetadataDto {
  @ApiProperty({
    description: 'Video duration in seconds',
    example: 30,
  })
  video_duration: number;

  @ApiProperty({
    description: 'Number of frames analyzed',
    example: 900,
  })
  frames_analyzed: number;

  @ApiProperty({
    description: 'Number of thumbnails generated',
    example: 5,
  })
  thumbnails_generated: number;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 15420,
  })
  processing_time_ms: number;
}

export class ProductDto {
  @ApiProperty({
    description: 'Seller handle (TikTok username)',
    example: 'nalu-fashion',
  })
  seller_handle: string;

  @ApiProperty({
    description: 'Unique video identifier',
    example: 'abc123def456',
  })
  video_id: string;

  @ApiProperty({
    description: 'Product title extracted from caption',
    example: 'Trendy Summer Heels',
  })
  title: string;

  @ApiProperty({
    description: 'Product price in cents (null if not found)',
    example: 5500,
    nullable: true,
  })
  price: number | null;

  @ApiProperty({
    description: 'Available sizes (null if not specified)',
    example: '37-41',
    nullable: true,
  })
  sizes: string | null;

  @ApiProperty({
    description: 'Product tags extracted from caption',
    example: ['heels', 'shoes', 'summer', 'fashion'],
    type: [String],
  })
  tags: string[];

  @ApiProperty({
    description: 'All generated thumbnails',
    type: [ThumbnailInfoDto],
  })
  thumbnails: ThumbnailInfoDto[];

  @ApiProperty({
    description: 'Primary thumbnail (best quality)',
    type: ThumbnailInfoDto,
  })
  primary_thumbnail: ThumbnailInfoDto;

  @ApiProperty({
    description: 'AI confidence score for caption parsing',
    example: 0.92,
    nullable: true,
  })
  confidence_score?: number;

  @ApiProperty({
    description: 'Original TikTok caption',
    example: 'Check out these amazing heels! Perfect for summer 👠 #fashion #heels',
    nullable: true,
  })
  raw_caption?: string;

  @ApiProperty({
    description: 'Video processing metadata',
    type: ProcessingMetadataDto,
  })
  processing_metadata: ProcessingMetadataDto;

  @ApiProperty({
    description: 'Product creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'Product last update timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  updated_at: string;
}

export class PaginationDto {
  @ApiProperty({
    description: 'Whether there are more products available',
    example: true,
  })
  hasMore: boolean;

  @ApiProperty({
    description: 'Pagination key for next page (URL-encoded)',
    example: '%7B%22seller_handle%22%3A%22nalu-fashion%22%2C%22video_id%22%3A%22abc123%22%7D',
    nullable: true,
  })
  lastEvaluatedKey: string | null;

  @ApiProperty({
    description: 'Number of products in current response',
    example: 20,
  })
  count: number;
}

export class ShopProductsResponseDto {
  @ApiProperty({
    description: 'List of products',
    type: [ProductDto],
  })
  products: ProductDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'Response metadata',
    example: {
      sellerHandle: 'nalu-fashion',
      since: null,
      timestamp: '2024-01-15T10:30:00.000Z',
    },
  })
  metadata: {
    sellerHandle: string;
    since: string | null;
    timestamp: string;
  };
}

export class DatabaseHealthDto {
  @ApiProperty({
    description: 'Overall health status',
    example: 'healthy',
    enum: ['healthy', 'unhealthy'],
  })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({
    description: 'Products table accessibility',
    example: 'accessible',
    enum: ['accessible', 'error'],
  })
  productsTable: 'accessible' | 'error';

  @ApiProperty({
    description: 'Staging table accessibility',
    example: 'accessible',
    enum: ['accessible', 'error'],
  })
  stagingTable: 'accessible' | 'error';

  @ApiProperty({
    description: 'Response latency in milliseconds',
    example: 45,
  })
  latency: number;

  @ApiProperty({
    description: 'Health check timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  timestamp: string;
}
