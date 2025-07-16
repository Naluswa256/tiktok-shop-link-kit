import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../../users/repository/user.repository';
import { JwtPayload, AuthenticatedUser } from '../interfaces/auth.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No token provided in request');
      throw new UnauthorizedException('Access token is required');
    }

    try {
      // Validate token with Cognito
      const payload = await this.authService.validateToken(token);
      
      // Get user from database
      const user = await this.userRepository.getUserByCognitoId(payload.sub);
      
      if (!user) {
        this.logger.warn(`User not found for Cognito ID: ${payload.sub}`);
        throw new UnauthorizedException('User not found');
      }

      // Attach user and token to request
      const authenticatedUser: AuthenticatedUser = {
        userId: user.userId,
        cognitoUserId: user.cognitoUserId!,
        handle: user.handle,
        phoneNumber: user.phoneNumber,
        subscriptionStatus: user.subscriptionStatus,
      };

      (request as any).user = authenticatedUser;
      (request as any).token = token;
      (request as any).jwtPayload = payload;

      return true;
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
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

// Decorator to mark routes as public (no authentication required)
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
