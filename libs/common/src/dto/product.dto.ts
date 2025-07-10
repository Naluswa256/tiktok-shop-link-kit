import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, IsUrl, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued'
}

export enum ProductCategory {
  FASHION = 'fashion',
  BEAUTY = 'beauty',
  ELECTRONICS = 'electronics',
  HOME = 'home',
  SPORTS = 'sports',
  FOOD = 'food',
  BOOKS = 'books',
  TOYS = 'toys',
  OTHER = 'other'
}

export class ProductDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsEnum(ProductStatus)
  status: ProductStatus;

  @IsArray()
  @IsUrl({}, { each: true })
  images: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inventory?: number;

  @IsOptional()
  @IsUrl()
  affiliateUrl?: string;

  @IsOptional()
  @IsString()
  tiktokVideoId?: string;

  @IsOptional()
  @Type(() => Date)
  createdAt?: Date;

  @IsOptional()
  @Type(() => Date)
  updatedAt?: Date;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsArray()
  @IsUrl({}, { each: true })
  images: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inventory?: number;

  @IsOptional()
  @IsUrl()
  affiliateUrl?: string;

  @IsOptional()
  @IsString()
  tiktokVideoId?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inventory?: number;

  @IsOptional()
  @IsUrl()
  affiliateUrl?: string;
}
