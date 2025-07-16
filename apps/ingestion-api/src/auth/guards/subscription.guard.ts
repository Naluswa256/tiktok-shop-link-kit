import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRepository } from '../../users/repository/user.repository';
import { SubscriptionStatus } from '../../users/entities/user.entity';
import { AuthenticatedUser, AuthErrorCode } from '../interfaces/auth.interface';

export class SubscriptionRequiredException extends HttpException {
  constructor(subscriptionStatus: string, userId: string) {
    super(
      {
        message: 'Active subscription required to access this resource',
        errorCode: AuthErrorCode.SUBSCRIPTION_REQUIRED,
        subscriptionStatus,
        userId,
      },
      HttpStatus.PAYMENT_REQUIRED
    );
    this.name = 'SubscriptionRequiredException';
  }
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if subscription check is disabled for this route
    const skipSubscriptionCheck = this.reflector.getAllAndOverride<boolean>(
      'skipSubscriptionCheck',
      [context.getHandler(), context.getClass()]
    );

    if (skipSubscriptionCheck) {
      return true;
    }

    // Get required subscription levels for this route
    const requiredSubscriptions = this.reflector.getAllAndOverride<SubscriptionStatus[]>(
      'requiredSubscriptions',
      [context.getHandler(), context.getClass()]
    ) || [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL];

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as AuthenticatedUser;

    if (!user) {
      this.logger.error('User not found in request. Ensure JwtAuthGuard is applied first.');
      throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
    }

    try {
      // Get fresh user data to check current subscription status
      const currentUser = await this.userRepository.getUserById(user.userId);
      
      if (!currentUser) {
        this.logger.error(`User not found: ${user.userId}`);
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Check if user's subscription status is in the required list
      if (!requiredSubscriptions.includes(currentUser.subscriptionStatus as SubscriptionStatus)) {
        this.logger.warn(
          `Access denied for user ${user.userId}. Required: ${requiredSubscriptions.join(', ')}, Current: ${currentUser.subscriptionStatus}`
        );
        
        throw new SubscriptionRequiredException(
          currentUser.subscriptionStatus,
          user.userId
        );
      }

      // Additional checks for trial subscriptions
      if (currentUser.subscriptionStatus === SubscriptionStatus.TRIAL) {
        const isTrialValid = await this.isTrialValid(currentUser);
        
        if (!isTrialValid) {
          this.logger.warn(`Trial expired for user ${user.userId}`);
          
          // Update user status to expired
          await this.userRepository.updateUser(user.userId, {
            subscriptionStatus: SubscriptionStatus.EXPIRED,
          });
          
          throw new SubscriptionRequiredException(
            SubscriptionStatus.EXPIRED,
            user.userId
          );
        }
      }

      // Additional checks for active subscriptions
      if (currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE) {
        const isSubscriptionValid = await this.isSubscriptionValid(currentUser);
        
        if (!isSubscriptionValid) {
          this.logger.warn(`Subscription expired for user ${user.userId}`);
          
          // Update user status to expired
          await this.userRepository.updateUser(user.userId, {
            subscriptionStatus: SubscriptionStatus.EXPIRED,
          });
          
          throw new SubscriptionRequiredException(
            SubscriptionStatus.EXPIRED,
            user.userId
          );
        }
      }

      // Update user object in request with fresh subscription status
      (request as any).user.subscriptionStatus = currentUser.subscriptionStatus;

      return true;
    } catch (error) {
      if (error instanceof SubscriptionRequiredException) {
        throw error;
      }
      
      this.logger.error(`Subscription check failed for user ${user.userId}:`, error);
      throw new HttpException(
        'Unable to verify subscription status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async isTrialValid(user: any): Promise<boolean> {
    if (!user.trialEndDate) {
      // If no trial end date is set, assume trial is still valid
      // This might happen for newly created users
      return true;
    }

    const trialEndDate = new Date(user.trialEndDate);
    const now = new Date();
    
    return now <= trialEndDate;
  }

  private async isSubscriptionValid(user: any): Promise<boolean> {
    if (!user.subscriptionEndDate) {
      // If no subscription end date is set, assume it's valid
      // This might be the case for lifetime subscriptions
      return true;
    }

    const subscriptionEndDate = new Date(user.subscriptionEndDate);
    const now = new Date();
    
    return now <= subscriptionEndDate;
  }
}

// Decorators for subscription control
import { SetMetadata } from '@nestjs/common';

export const SKIP_SUBSCRIPTION_CHECK_KEY = 'skipSubscriptionCheck';
export const REQUIRED_SUBSCRIPTIONS_KEY = 'requiredSubscriptions';

export const SkipSubscriptionCheck = () => 
  SetMetadata(SKIP_SUBSCRIPTION_CHECK_KEY, true);

export const RequireSubscription = (...subscriptions: SubscriptionStatus[]) =>
  SetMetadata(REQUIRED_SUBSCRIPTIONS_KEY, subscriptions);

// Convenience decorators
export const RequireActiveSubscription = () =>
  RequireSubscription(SubscriptionStatus.ACTIVE);

export const RequireTrialOrActive = () =>
  RequireSubscription(SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE);

export const RequireAnySubscription = () =>
  RequireSubscription(
    SubscriptionStatus.PENDING,
    SubscriptionStatus.TRIAL,
    SubscriptionStatus.ACTIVE
  );
