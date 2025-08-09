import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  error: {
    type: string;
    message: string;
    details?: any;
    code?: string;
  };
  timestamp: string;
  path: string;
  requestId?: string;
  meta?: {
    performance?: {
      responseTime: number;
    };
  };
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const startTime = (request as any).startTime || Date.now();
    const responseTime = Date.now() - startTime;

    const exceptionResponse = exception.getResponse();
    const errorMessage = typeof exceptionResponse === 'string' 
      ? exceptionResponse 
      : (exceptionResponse as any)?.message || exception.message;

    const errorDetails = typeof exceptionResponse === 'object' 
      ? exceptionResponse 
      : null;

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      error: {
        type: this.getErrorType(status),
        message: Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage,
        details: errorDetails,
        code: this.getErrorCode(status),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as any).id,
      meta: {
        performance: {
          responseTime,
        },
      },
    };

    // Log error with appropriate level
    if (status >= 500) {
      this.logger.error('Internal server error', {
        statusCode: status,
        message: errorMessage,
        path: request.url,
        method: request.method,
        userAgent: request.get('User-Agent'),
        ip: request.ip,
        stack: exception.stack,
      });
    } else if (status >= 400) {
      this.logger.warn('Client error', {
        statusCode: status,
        message: errorMessage,
        path: request.url,
        method: request.method,
        body: request.body,
        query: request.query,
        params: request.params,
      });
    }

    response.status(status).json(errorResponse);
  }

  private getErrorType(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTHENTICATION_ERROR';
      case HttpStatus.FORBIDDEN:
        return 'AUTHORIZATION_ERROR';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'RESOURCE_CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'BUSINESS_LOGIC_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      case HttpStatus.BAD_GATEWAY:
        return 'EXTERNAL_SERVICE_ERROR';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'TIMEOUT_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'E400001';
      case HttpStatus.UNAUTHORIZED:
        return 'E401001';
      case HttpStatus.FORBIDDEN:
        return 'E403001';
      case HttpStatus.NOT_FOUND:
        return 'E404001';
      case HttpStatus.CONFLICT:
        return 'E409001';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'E422001';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'E429001';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'E500001';
      case HttpStatus.BAD_GATEWAY:
        return 'E502001';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'E503001';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'E504001';
      default:
        return `E${status}001`;
    }
  }
}
