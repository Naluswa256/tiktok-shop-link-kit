import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponseDto, PaginatedResponseDto } from '../dto/api-response.dto';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const requestId = this.getRequestId(request);

        // Log successful requests
        this.logRequest(request, response, duration, requestId);

        // If data is already an ApiResponseDto, return as is
        if (data instanceof ApiResponseDto || data instanceof PaginatedResponseDto) {
          return data;
        }

        // If data is null or undefined, return success with no data
        if (data === null || data === undefined) {
          return ApiResponseDto.success(null, 'Success', { duration }, requestId);
        }

        // Check if this is a paginated response
        if (this.isPaginatedResponse(data)) {
          return new PaginatedResponseDto(
            data.data,
            data.page,
            data.limit,
            data.total,
            'Success',
            requestId
          );
        }

        // Wrap regular data in success response
        return ApiResponseDto.success(data, 'Success', { duration }, requestId);
      })
    );
  }

  private isPaginatedResponse(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      'data' in data &&
      'page' in data &&
      'limit' in data &&
      'total' in data &&
      Array.isArray(data.data)
    );
  }

  private getRequestId(request: Request): string {
    return (request as any).requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logRequest(
    request: Request,
    response: Response,
    duration: number,
    requestId: string
  ): void {
    const { method, url, body, query, params, headers } = request;
    const statusCode = response.statusCode;
    const userAgent = headers['user-agent'] || '';
    const ip = headers['x-forwarded-for'] || request.connection.remoteAddress;

    const logContext = {
      requestId,
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      userAgent,
      ip,
      body: this.sanitizeBody(body),
      query,
      params,
    };

    if (statusCode >= 400) {
      this.logger.warn(
        `${method} ${url} - ${statusCode} - ${duration}ms`,
        logContext
      );
    } else {
      this.logger.log(
        `${method} ${url} - ${statusCode} - ${duration}ms`,
        logContext
      );
    }
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = ['password', 'token', 'code', 'secret', 'key'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    }

    return sanitized;
  }
}

// Decorator to exclude routes from response wrapping
export const NoResponseWrapper = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('no-response-wrapper', true, descriptor.value);
  };
};

// Enhanced interceptor that respects the decorator
@Injectable()
export class ConditionalResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ConditionalResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const noWrapper = Reflect.getMetadata('no-response-wrapper', handler);

    if (noWrapper) {
      return next.handle();
    }

    const responseInterceptor = new ResponseInterceptor();
    return responseInterceptor.intercept(context, next);
  }
}
