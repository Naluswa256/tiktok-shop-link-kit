import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsObject, IsArray } from 'class-validator';

export class ApiResponseDto<T = any> {
  @IsBoolean()
  success: boolean;

  @IsOptional()
  data?: T;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsArray()
  errors?: string[];

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @IsString()
  timestamp: string;

  constructor(success: boolean, data?: T, message?: string, errorCode?: string, errors?: string[]) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.errorCode = errorCode;
    this.errors = errors;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data?: T, message?: string, meta?: Record<string, any>): ApiResponseDto<T> {
    const response = new ApiResponseDto(true, data, message);
    if (meta) {
      response.meta = meta;
    }
    return response;
  }

  static error(message: string, errorCode?: string, errors?: string[]): ApiResponseDto {
    return new ApiResponseDto(false, undefined, message, errorCode, errors);
  }
}

export class PaginationDto {
  @IsNumber()
  page: number;

  @IsNumber()
  limit: number;

  @IsNumber()
  total: number;

  @IsNumber()
  totalPages: number;

  @IsBoolean()
  hasNext: boolean;

  @IsBoolean()
  hasPrev: boolean;

  constructor(page: number, limit: number, total: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}

export class PaginatedResponseDto<T> extends ApiResponseDto<T[]> {
  @IsObject()
  pagination: PaginationDto;

  constructor(data: T[], page: number, limit: number, total: number, message?: string) {
    super(true, data, message);
    this.pagination = new PaginationDto(page, limit, total);
  }

  static create<T>(data: T[], page: number, limit: number, total: number, message?: string): PaginatedResponseDto<T> {
    return new PaginatedResponseDto(data, page, limit, total, message);
  }
}
