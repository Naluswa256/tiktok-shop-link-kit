import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
  meta?: {
    pagination?: {
      page?: number;
      limit?: number;
      total?: number;
      hasMore?: boolean;
      lastEvaluatedKey?: string;
    };
    performance?: {
      responseTime?: number;
    };
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const startTime = Date.now();
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    return next.handle().pipe(
      map((data) => {
        const responseTime = Date.now() - startTime;
        
        // Handle different response types
        let responseData = data;
        let meta: any = {
          performance: {
            responseTime,
          },
        };

        // If data has pagination info, extract it
        if (data && typeof data === 'object' && 'pagination' in data) {
          meta.pagination = data.pagination;
          responseData = data.products || data.data || data;
        }

        // If data has metadata, merge it
        if (data && typeof data === 'object' && 'metadata' in data) {
          meta = { ...meta, ...data.metadata };
          responseData = data.products || data.data || data;
        }

        return {
          success: true,
          statusCode: response.statusCode,
          message: this.getSuccessMessage(request.method, request.url),
          data: responseData,
          timestamp: new Date().toISOString(),
          path: request.url,
          meta,
        };
      }),
    );
  }

  private getSuccessMessage(method: string, url: string): string {
    if (url.includes('/health')) return 'Health check completed successfully';
    if (url.includes('/stats')) return 'Statistics retrieved successfully';
    if (url.includes('/products') && method === 'GET') {
      return url.includes('/shop/') 
        ? 'Shop products retrieved successfully'
        : 'Products retrieved successfully';
    }
    
    switch (method) {
      case 'GET':
        return 'Data retrieved successfully';
      case 'POST':
        return 'Resource created successfully';
      case 'PUT':
      case 'PATCH':
        return 'Resource updated successfully';
      case 'DELETE':
        return 'Resource deleted successfully';
      default:
        return 'Operation completed successfully';
    }
  }
}
