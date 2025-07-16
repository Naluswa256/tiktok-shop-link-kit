import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponseDto } from '../dto/api-response.dto';
import { AuthErrorCode } from '../../auth/interfaces/auth.interface';

interface ErrorResponse {
  statusCode: number;
  message: string;
  errorCode?: string;
  errors?: string[];
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.getErrorResponse(exception);
    const requestId = this.getRequestId(request);

    // Log the error
    this.logError(exception, request, errorResponse, requestId);

    // Send unified error response
    const apiResponse = ApiResponseDto.error(
      errorResponse.message,
      errorResponse.errorCode,
      errorResponse.errors,
      requestId
    );

    response.status(errorResponse.statusCode).json(apiResponse);
  }

  private getErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          statusCode: status,
          message: exceptionResponse,
          errorCode: this.getErrorCodeFromStatus(status),
        };
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as any;
        return {
          statusCode: status,
          message: response.message || exception.message,
          errorCode: response.errorCode || this.getErrorCodeFromStatus(status),
          errors: Array.isArray(response.message) ? response.message : undefined,
        };
      }
    }

    // Handle AWS Cognito errors
    if (this.isCognitoError(exception)) {
      return this.handleCognitoError(exception as any);
    }

    // Handle DynamoDB errors
    if (this.isDynamoDBError(exception)) {
      return this.handleDynamoDBError(exception as any);
    }

    // Handle validation errors
    if (this.isValidationError(exception)) {
      return this.handleValidationError(exception as any);
    }

    // Handle subscription required errors
    if (this.isSubscriptionRequiredError(exception)) {
      return {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message: 'Subscription required to access this resource',
        errorCode: AuthErrorCode.SUBSCRIPTION_REQUIRED,
      };
    }

    // Default error response
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    };
  }

  private isCognitoError(exception: unknown): boolean {
    return (
      exception &&
      typeof exception === 'object' &&
      'name' in exception &&
      typeof (exception as any).name === 'string' &&
      (exception as any).name.includes('Cognito')
    );
  }

  private handleCognitoError(error: any): ErrorResponse {
    const errorMap: Record<string, { status: number; code: string; message: string }> = {
      UserNotFoundException: {
        status: HttpStatus.NOT_FOUND,
        code: AuthErrorCode.USER_NOT_FOUND,
        message: 'User not found',
      },
      CodeMismatchException: {
        status: HttpStatus.BAD_REQUEST,
        code: AuthErrorCode.INVALID_CODE,
        message: 'Invalid verification code',
      },
      ExpiredCodeException: {
        status: HttpStatus.BAD_REQUEST,
        code: AuthErrorCode.CODE_EXPIRED,
        message: 'Verification code has expired',
      },
      TooManyRequestsException: {
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: AuthErrorCode.TOO_MANY_ATTEMPTS,
        message: 'Too many attempts. Please try again later',
      },
      UsernameExistsException: {
        status: HttpStatus.CONFLICT,
        code: AuthErrorCode.PHONE_ALREADY_EXISTS,
        message: 'Phone number already registered',
      },
      InvalidParameterException: {
        status: HttpStatus.BAD_REQUEST,
        code: 'INVALID_PARAMETER',
        message: 'Invalid parameter provided',
      },
    };

    const errorInfo = errorMap[error.name] || {
      status: HttpStatus.BAD_REQUEST,
      code: 'COGNITO_ERROR',
      message: error.message || 'Authentication error',
    };

    return {
      statusCode: errorInfo.status,
      message: errorInfo.message,
      errorCode: errorInfo.code,
    };
  }

  private isDynamoDBError(exception: unknown): boolean {
    return (
      exception &&
      typeof exception === 'object' &&
      'name' in exception &&
      typeof (exception as any).name === 'string' &&
      ((exception as any).name.includes('DynamoDB') || (exception as any).name.includes('ResourceNotFoundException'))
    );
  }

  private handleDynamoDBError(error: any): ErrorResponse {
    const errorMap: Record<string, { status: number; code: string; message: string }> = {
      ResourceNotFoundException: {
        status: HttpStatus.NOT_FOUND,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
      },
      ConditionalCheckFailedException: {
        status: HttpStatus.CONFLICT,
        code: 'RESOURCE_CONFLICT',
        message: 'Resource already exists or condition failed',
      },
      ValidationException: {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
      },
      ProvisionedThroughputExceededException: {
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Request rate limit exceeded',
      },
    };

    const errorInfo = errorMap[error.name] || {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'DATABASE_ERROR',
      message: 'Database operation failed',
    };

    return {
      statusCode: errorInfo.status,
      message: errorInfo.message,
      errorCode: errorInfo.code,
    };
  }

  private isValidationError(exception: unknown): boolean {
    return (
      exception &&
      typeof exception === 'object' &&
      'name' in exception &&
      (exception as any).name === 'ValidationError'
    );
  }

  private handleValidationError(error: any): ErrorResponse {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      errors: error.details || [error.message],
    };
  }

  private isSubscriptionRequiredError(exception: unknown): boolean {
    return (
      exception &&
      typeof exception === 'object' &&
      'name' in exception &&
      (exception as any).name === 'SubscriptionRequiredException'
    );
  }

  private getErrorCodeFromStatus(status: number): string {
    const statusMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return statusMap[status] || 'UNKNOWN_ERROR';
  }

  private getRequestId(request: Request): string {
    return (request as any).requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logError(
    exception: unknown,
    request: Request,
    errorResponse: ErrorResponse,
    requestId: string
  ): void {
    const { method, url, body, query, params, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = headers['x-forwarded-for'] || request.connection.remoteAddress;

    const logContext = {
      requestId,
      method,
      url,
      statusCode: errorResponse.statusCode,
      errorCode: errorResponse.errorCode,
      userAgent,
      ip,
      body: this.sanitizeBody(body),
      query,
      params,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `${method} ${url} - ${errorResponse.statusCode} - ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : exception,
        logContext
      );
    } else {
      this.logger.warn(
        `${method} ${url} - ${errorResponse.statusCode} - ${errorResponse.message}`,
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
