import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdminAuthService, AdminJwtPayload } from '../services/admin-auth.service';

export interface AuthenticatedAdminRequest extends Request {
  admin: {
    username: string;
    role: string;
    sessionId: string;
  };
  adminToken: string;
  adminJwtPayload: AdminJwtPayload;
}

@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminJwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private adminAuthService: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public (for admin routes that don't need auth)
    const isPublic = this.reflector.getAllAndOverride<boolean>('isAdminPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No admin token provided in request');
      throw new UnauthorizedException('Admin access token is required');
    }

    try {
      // Validate token
      const payload = await this.adminAuthService.validateAccessToken(token);
      
      // Verify it's an admin token
      if (payload.role !== 'admin') {
        this.logger.warn(`Invalid role in admin token: ${payload.role}`);
        throw new UnauthorizedException('Invalid admin token');
      }

      // Attach admin info to request
      const authenticatedRequest = request as AuthenticatedAdminRequest;
      authenticatedRequest.admin = {
        username: payload.sub,
        role: payload.role,
        sessionId: payload.sessionId,
      };
      authenticatedRequest.adminToken = token;
      authenticatedRequest.adminJwtPayload = payload;

      return true;
    } catch (error) {
      this.logger.warn(`Admin token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }
}

// Decorator to mark admin routes as public (no authentication required)
import { SetMetadata } from '@nestjs/common';

export const IS_ADMIN_PUBLIC_KEY = 'isAdminPublic';
export const AdminPublic = () => SetMetadata(IS_ADMIN_PUBLIC_KEY, true);
