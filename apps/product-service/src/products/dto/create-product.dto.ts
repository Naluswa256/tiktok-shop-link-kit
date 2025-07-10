import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, IsUrl, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Trendy Summer Dress'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'A beautiful summer dress perfect for any occasion'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Product price in cents',
    example: 2999
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Product category',
    example: 'Fashion'
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Product images URLs',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
  })
  @IsArray()
  @IsUrl({}, { each: true })
  images: string[];

  @ApiProperty({
    description: 'Product tags',
    example: ['summer', 'dress', 'fashion'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'TikTok video URL that featured this product',
    example: 'https://www.tiktok.com/@username/video/1234567890123456789',
    required: false
  })
  @IsOptional()
  @IsUrl()
  tiktokUrl?: string;

  @ApiProperty({
    description: 'Product availability status',
    example: 'in_stock',
    required: false
  })
  @IsOptional()
  @IsString()
  status?: string;
}
