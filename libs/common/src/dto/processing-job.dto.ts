import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProcessingStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum ProcessingType {
  CAPTION_ANALYSIS = 'caption_analysis',
  THUMBNAIL_GENERATION = 'thumbnail_generation',
  AUTO_TAGGING = 'auto_tagging',
  PRODUCT_EXTRACTION = 'product_extraction',
  FULL_PROCESSING = 'full_processing'
}

export class ProcessingJobDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsEnum(ProcessingType)
  type: ProcessingType;

  @IsEnum(ProcessingStatus)
  status: ProcessingStatus;

  @IsString()
  @IsNotEmpty()
  videoId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  inputData?: Record<string, any>;

  @IsOptional()
  @IsObject()
  outputData?: Record<string, any>;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  progress?: number;

  @IsOptional()
  @Type(() => Date)
  startedAt?: Date;

  @IsOptional()
  @Type(() => Date)
  completedAt?: Date;

  @IsOptional()
  @Type(() => Date)
  createdAt?: Date;

  @IsOptional()
  @Type(() => Date)
  updatedAt?: Date;
}

export class CreateProcessingJobDto {
  @IsEnum(ProcessingType)
  type: ProcessingType;

  @IsString()
  @IsNotEmpty()
  videoId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  inputData?: Record<string, any>;
}

export class UpdateProcessingJobDto {
  @IsOptional()
  @IsEnum(ProcessingStatus)
  status?: ProcessingStatus;

  @IsOptional()
  @IsObject()
  outputData?: Record<string, any>;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  progress?: number;
}
