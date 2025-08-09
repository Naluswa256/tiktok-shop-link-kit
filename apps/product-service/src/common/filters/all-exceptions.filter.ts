import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from './http-exception.filter';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const startTime = (request as any).startTime || Date.now();
    const responseTime = Date.now() - startTime;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorType = 'INTERNAL_SERVER_ERROR';
    let errorCode = 'E500001';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    } else if (exception instanceof Error) {
      // Handle specific error types
      if (exception.name === 'ValidationError') {
        status = HttpStatus.BAD_REQUEST;
        message = exception.message;
        errorType = 'VALIDATION_ERROR';
        errorCode = 'E400002';
      } else if (exception.name === 'CastError') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid data format';
        errorType = 'VALIDATION_ERROR';
        errorCode = 'E400003';
      } else if (exception.name === 'MongoError' || exception.name === 'MongooseError') {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database error';
        errorType = 'DATABASE_ERROR';
        errorCode = 'E500002';
      } else if (exception.name === 'TimeoutError') {
        status = HttpStatus.GATEWAY_TIMEOUT;
        message = 'Request timeout';
        errorType = 'TIMEOUT_ERROR';
        errorCode = 'E504002';
      } else if (exception.message?.includes('DynamoDB') || exception.message?.includes('AWS')) {
        status = HttpStatus.BAD_GATEWAY;
        message = 'External service error';
        errorType = 'EXTERNAL_SERVICE_ERROR';
        errorCode = 'E502002';
      }
    }

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      error: {
        type: errorType,
        message,
        code: errorCode,
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

    // Log the error with full details
    this.logger.error('Unhandled exception caught', {
      statusCode: status,
      message,
      path: request.url,
      method: request.method,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      stack: exception instanceof Error ? exception.stack : 'No stack trace available',
      body: request.body,
      query: request.query,
      params: request.params,
      exception: exception instanceof Error ? {
        name: exception.name,
        message: exception.message,
      } : exception,
    });

    response.status(status).json(errorResponse);
  }
}
