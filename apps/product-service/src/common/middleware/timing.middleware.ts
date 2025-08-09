import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TimingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TimingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    // Add timing and request ID to request object
    (req as any).startTime = startTime;
    (req as any).id = requestId;

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);

    // Log incoming request
    this.logger.log('Incoming request', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: req.get('Content-Length'),
    });

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const responseTime = Date.now() - startTime;
      
      // Log response
      const logger = new Logger(TimingMiddleware.name);
      logger.log('Request completed', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        contentLength: res.get('Content-Length'),
      });

      // Call original end method
      originalEnd.call(this, chunk, encoding);
    };

    next();
  }
}
