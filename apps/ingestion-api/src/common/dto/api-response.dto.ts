import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty({ description: 'Indicates if the request was successful' })
  success: boolean;

  @ApiProperty({ description: 'Response data', required: false })
  data?: T;

  @ApiProperty({ description: 'Success or error message', required: false })
  message?: string;

  @ApiProperty({ description: 'Error code for client handling', required: false })
  errorCode?: string;

  @ApiProperty({ description: 'Detailed error information', required: false })
  errors?: string[];

  @ApiProperty({ description: 'Additional metadata', required: false })
  meta?: Record<string, any>;

  @ApiProperty({ description: 'Request timestamp' })
  timestamp: string;

  @ApiProperty({ description: 'Request ID for tracking' })
  requestId: string;

  constructor(
    success: boolean,
    data?: T,
    message?: string,
    errorCode?: string,
    errors?: string[],
    meta?: Record<string, any>,
    requestId?: string
  ) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.errorCode = errorCode;
    this.errors = errors;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId || this.generateRequestId();
  }

  static success<T>(
    data?: T,
    message?: string,
    meta?: Record<string, any>,
    requestId?: string
  ): ApiResponseDto<T> {
    return new ApiResponseDto(true, data, message, undefined, undefined, meta, requestId);
  }

  static error(
    message: string,
    errorCode?: string,
    errors?: string[],
    requestId?: string
  ): ApiResponseDto {
    return new ApiResponseDto(false, undefined, message, errorCode, errors, undefined, requestId);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of items' })
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
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
  @ApiProperty({ description: 'Pagination metadata' })
  pagination: PaginationMetaDto;

  constructor(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string,
    requestId?: string
  ) {
    super(true, data, message, undefined, undefined, undefined, requestId);
    this.pagination = new PaginationMetaDto(page, limit, total);
  }

  static create<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string,
    requestId?: string
  ): PaginatedResponseDto<T> {
    return new PaginatedResponseDto(data, page, limit, total, message, requestId);
  }
}
