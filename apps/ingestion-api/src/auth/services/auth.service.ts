import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  GlobalSignOutCommand,
  ChallengeNameType,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { JwtService } from '@nestjs/jwt';
import { TikTokLookupService } from './tiktok-lookup.service';
import { UserRepository } from '../../users/repository/user.repository';
import { ShopService } from '../../shop/services/shop.service';
import {
  CognitoAuthResult,
  AuthSession,
  JwtPayload,
  AuthServiceInterface,
  TikTokProfileValidation,
  AuthErrorCode,
} from '../interfaces/auth.interface';
import { CreateUserInput, SubscriptionStatus } from '../../users/entities/user.entity';

// Session storage for temporary auth sessions (in-memory for now, could be Redis in production)
interface AuthSessionData {
  session: string;
  challengeName: string;
  handle: string;
  phoneNumber: string;
  createdAt: number;
  expiresAt: number;
}

// Cache for validated handles to avoid re-validation and save Apify credits
interface HandleValidationCache {
  result: TikTokProfileValidation;
  timestamp: number;
  expiresAt: number;
}

@Injectable()
export class AuthService implements AuthServiceInterface {
  private readonly logger = new Logger(AuthService.name);
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;

  // In-memory caches for optimization (use Redis in production)
  private readonly authSessions = new Map<string, AuthSessionData>();
  private readonly handleValidationCache = new Map<string, HandleValidationCache>();
  private readonly SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  private readonly HANDLE_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly tiktokLookupService: TikTokLookupService,
    private readonly userRepository: UserRepository,
    private readonly shopService: ShopService,
  ) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    });
    
    this.userPoolId = this.configService.get('COGNITO_USER_POOL_ID');
    this.clientId = this.configService.get('COGNITO_CLIENT_ID');

    if (!this.userPoolId || !this.clientId) {
      this.logger.error('Cognito configuration missing');
      throw new Error('Cognito configuration missing');
    }
  }

  /**
   * Cache management methods for optimization
   */
  private generateSessionKey(handle: string, phoneNumber: string): string {
    return `${handle}:${phoneNumber}`;
  }

  private storeAuthSession(handle: string, phoneNumber: string, session: string, challengeName: string): void {
    const key = this.generateSessionKey(handle, phoneNumber);
    const now = Date.now();
    this.authSessions.set(key, {
      session,
      challengeName,
      handle,
      phoneNumber,
      createdAt: now,
      expiresAt: now + this.SESSION_TIMEOUT,
    });
  }

  private getAuthSession(handle: string, phoneNumber: string): AuthSessionData | null {
    const key = this.generateSessionKey(handle, phoneNumber);
    const sessionData = this.authSessions.get(key);

    if (!sessionData || Date.now() > sessionData.expiresAt) {
      this.authSessions.delete(key);
      return null;
    }

    return sessionData;
  }

  private cacheHandleValidation(handle: string, result: TikTokProfileValidation): void {
    const now = Date.now();
    this.handleValidationCache.set(handle, {
      result,
      timestamp: now,
      expiresAt: now + this.HANDLE_CACHE_TIMEOUT,
    });
  }

  private getCachedHandleValidation(handle: string): TikTokProfileValidation | null {
    const cached = this.handleValidationCache.get(handle);

    if (!cached || Date.now() > cached.expiresAt) {
      this.handleValidationCache.delete(handle);
      return null;
    }

    return cached.result;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedValidations = 0;

    // Clean expired auth sessions
    for (const [key, session] of this.authSessions.entries()) {
      if (now > session.expiresAt) {
        this.authSessions.delete(key);
        cleanedSessions++;
      }
    }

    // Clean expired handle validations
    for (const [key, validation] of this.handleValidationCache.entries()) {
      if (now > validation.expiresAt) {
        this.handleValidationCache.delete(key);
        cleanedValidations++;
      }
    }

    if (cleanedSessions > 0 || cleanedValidations > 0) {
      this.logger.debug(`Cleaned up ${cleanedSessions} expired sessions and ${cleanedValidations} expired validations`);
    }
  }

  private clearAuthSession(handle: string, phoneNumber: string): void {
    const key = this.generateSessionKey(handle, phoneNumber);
    this.authSessions.delete(key);
  }

  async validateHandle(handle: string): Promise<TikTokProfileValidation> {
    try {
      this.logger.log(`Validating TikTok handle: ${handle}`);
      
      // Check if handle already exists in our database
      const existingUser = await this.userRepository.getUserByHandle(handle);
      if (existingUser) {
        throw new HttpException(
          'This TikTok handle is already registered',
          HttpStatus.CONFLICT,
          { cause: { errorCode: AuthErrorCode.HANDLE_ALREADY_EXISTS } }
        );
      }

      // Check cache first to avoid wasting Apify credits
      const cachedValidation = this.getCachedHandleValidation(handle);
      if (cachedValidation) {
        this.logger.log(`Using cached validation for handle: ${handle}`);
        return cachedValidation;
      }

      // Validate handle with TikTok (only if not cached)
      this.logger.log(`Performing fresh validation for handle: ${handle}`);
      const result = await this.tiktokLookupService.validateHandle(handle);

      if (!result.exists) {
        throw new HttpException(
          'TikTok handle not found. Please check the handle and try again.',
          HttpStatus.NOT_FOUND,
          { cause: { errorCode: AuthErrorCode.HANDLE_NOT_FOUND } }
        );
      }

      // Cache the successful validation
      this.cacheHandleValidation(handle, result);
      this.logger.log(`Handle validation successful and cached: ${handle}`);

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Handle validation failed: ${handle}`, error);
      throw new HttpException(
        'Unable to validate TikTok handle at this time',
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause: { errorCode: AuthErrorCode.SERVICE_UNAVAILABLE } }
      );
    }
  }

  async initiateSignup(handle: string, phoneNumber: string): Promise<AuthSession> {
    try {
      this.logger.log(`Initiating signup for handle: ${handle}, phone: ${phoneNumber}`);

      // Validate handle first - this will throw an error if handle doesn't exist on TikTok
      // or if it's already registered in our database
      const handleValidation = await this.validateHandle(handle);
      this.logger.log(`Handle validation successful for ${handle}:`, {
        exists: handleValidation.exists,
        verified: handleValidation.isVerified,
        followers: handleValidation.followerCount
      });

      // Check if phone number already exists
      const existingUserByPhone = await this.userRepository.getUserByPhone(phoneNumber);
      if (existingUserByPhone) {
        throw new HttpException(
          'This phone number is already registered',
          HttpStatus.CONFLICT,
          { cause: { errorCode: AuthErrorCode.PHONE_ALREADY_EXISTS } }
        );
      }

      // Create user in Cognito with custom attributes
      // Use handle as username since phone_number is an alias attribute
      await this.cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: handle,
          UserAttributes: [
            {
              Name: 'phone_number',
              Value: phoneNumber,
            },
            {
              Name: 'phone_number_verified',
              Value: 'false',
            },
            {
              Name: 'custom:tiktok_handle',
              Value: handle,
            },
          ],
          MessageAction: 'SUPPRESS', // We'll handle OTP ourselves
          TemporaryPassword: this.generateTemporaryPassword(),
        })
      );

      // Initiate custom auth flow for SMS OTP
      // Use handle as username since that's what we used to create the user
      const authResult = await this.cognitoClient.send(
        new InitiateAuthCommand({
          ClientId: this.clientId,
          AuthFlow: AuthFlowType.CUSTOM_AUTH,
          AuthParameters: {
            USERNAME: handle,
          },
        })
      );

      if (!authResult.Session || !authResult.ChallengeName) {
        throw new Error('Failed to initiate auth challenge');
      }

      // Store the session for later use in confirmSignup (optimization)
      this.storeAuthSession(handle, phoneNumber, authResult.Session, authResult.ChallengeName);

      // Clean up expired sessions periodically
      this.cleanupExpiredSessions();

      this.logger.log(`Signup OTP sent to: ${phoneNumber} (session stored)`);

      return {
        session: authResult.Session,
        challengeName: authResult.ChallengeName,
        challengeParameters: authResult.ChallengeParameters,
      };
    } catch (error) {
      this.logger.error(`Signup initiation failed: ${handle}, ${phoneNumber}`, error);
      throw this.handleCognitoError(error);
    }
  }

  async confirmSignup(handle: string, phoneNumber: string, code: string): Promise<CognitoAuthResult> {
    try {
      this.logger.log(`Confirming signup for handle: ${handle}, phone: ${phoneNumber}`);

      // Try to get stored session first (optimization - avoids re-initiating auth)
      let sessionData = this.getAuthSession(handle, phoneNumber);
      let authSession: string;

      if (sessionData) {
        this.logger.log(`Using stored session for ${handle}`);
        authSession = sessionData.session;
      } else {
        // Fallback: initiate new auth flow if session not found or expired
        this.logger.log(`No stored session found, initiating new auth flow for ${handle}`);
        const authResult = await this.cognitoClient.send(
          new InitiateAuthCommand({
            ClientId: this.clientId,
            AuthFlow: AuthFlowType.CUSTOM_AUTH,
            AuthParameters: {
              USERNAME: handle,
            },
          })
        );

        if (!authResult.Session) {
          throw new Error('Failed to get auth session');
        }

        authSession = authResult.Session;
      }

      // Respond to the SMS challenge using the session we obtained
      const challengeResult = await this.cognitoClient.send(
        new RespondToAuthChallengeCommand({
          ClientId: this.clientId,
          ChallengeName: ChallengeNameType.CUSTOM_CHALLENGE,
          Session: authSession,
          ChallengeResponses: {
            USERNAME: handle,
            ANSWER: code,
          },
        })
      );

      if (!challengeResult.AuthenticationResult) {
        throw new Error('Authentication failed');
      }

      // Mark phone as verified
      await this.cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: this.userPoolId,
          Username: handle,
          UserAttributes: [
            {
              Name: 'phone_number_verified',
              Value: 'true',
            },
          ],
        })
      );

      // Get handle validation data for user creation
      const handleValidation = await this.tiktokLookupService.validateHandle(handle);

      // Create user in our database
      const userInput: CreateUserInput = {
        handle,
        phoneNumber,
        profilePhotoUrl: handleValidation.profilePhotoUrl,
        displayName: handleValidation.displayName,
        followerCount: handleValidation.followerCount,
        isVerified: handleValidation.isVerified,
        cognitoUserId: this.extractSubFromToken(challengeResult.AuthenticationResult.AccessToken!),
      };

      const user = await this.userRepository.createUser(userInput);

      // Create shop entry in Shops table
      await this.shopService.createShop({
        handle,
        phone: phoneNumber,
        subscription_status: 'trial',
        user_id: user.userId,
        display_name: handleValidation.displayName,
        profile_photo_url: handleValidation.profilePhotoUrl,
        follower_count: handleValidation.followerCount,
        is_verified: handleValidation.isVerified,
      });

      // Clear the used session (cleanup)
      this.clearAuthSession(handle, phoneNumber);

      this.logger.log(`User and shop created successfully: ${user.userId}`);

      return {
        accessToken: challengeResult.AuthenticationResult.AccessToken!,
        refreshToken: challengeResult.AuthenticationResult.RefreshToken!,
        idToken: challengeResult.AuthenticationResult.IdToken!,
        expiresIn: challengeResult.AuthenticationResult.ExpiresIn!,
        tokenType: challengeResult.AuthenticationResult.TokenType!,
      };
    } catch (error) {
      this.logger.error(`Signup confirmation failed: ${handle}, ${phoneNumber}`, error);
      throw this.handleCognitoError(error);
    }
  }

  async initiateSignin(phoneNumber: string): Promise<AuthSession> {
    try {
      this.logger.log(`Initiating signin for phone: ${phoneNumber}`);

      // Check if user exists in our database
      const user = await this.userRepository.getUserByPhone(phoneNumber);
      if (!user) {
        throw new HttpException(
          'User not found. Please sign up first.',
          HttpStatus.NOT_FOUND,
          { cause: { errorCode: AuthErrorCode.USER_NOT_FOUND } }
        );
      }

      // Initiate custom auth flow for SMS OTP using the user's handle as username
      const authResult = await this.cognitoClient.send(
        new InitiateAuthCommand({
          ClientId: this.clientId,
          AuthFlow: AuthFlowType.CUSTOM_AUTH,
          AuthParameters: {
            USERNAME: user.handle,
          },
        })
      );

      if (!authResult.Session || !authResult.ChallengeName) {
        throw new Error('Failed to initiate auth challenge');
      }

      // Store the session for later use in confirmSignin (optimization)
      this.storeAuthSession(user.handle, phoneNumber, authResult.Session, authResult.ChallengeName);

      // Clean up expired sessions periodically
      this.cleanupExpiredSessions();

      this.logger.log(`Signin OTP sent to: ${phoneNumber} (session stored)`);

      return {
        session: authResult.Session,
        challengeName: authResult.ChallengeName,
        challengeParameters: authResult.ChallengeParameters,
      };
    } catch (error) {
      this.logger.error(`Signin initiation failed: ${phoneNumber}`, error);
      throw this.handleCognitoError(error);
    }
  }

  async confirmSignin(phoneNumber: string, code: string): Promise<CognitoAuthResult> {
    try {
      this.logger.log(`Confirming signin for phone: ${phoneNumber}`);

      // Get user to find their handle
      const user = await this.userRepository.getUserByPhone(phoneNumber);
      if (!user) {
        throw new HttpException(
          'User not found. Please sign up first.',
          HttpStatus.NOT_FOUND,
          { cause: { errorCode: AuthErrorCode.USER_NOT_FOUND } }
        );
      }

      // Try to get stored session first (optimization - avoids re-initiating auth)
      let sessionData = this.getAuthSession(user.handle, phoneNumber);
      let authSession: string;

      if (sessionData) {
        this.logger.log(`Using stored session for signin: ${phoneNumber}`);
        authSession = sessionData.session;
      } else {
        // Fallback: initiate new auth flow if session not found or expired
        this.logger.log(`No stored session found, initiating new auth flow for signin: ${phoneNumber}`);
        const authResult = await this.cognitoClient.send(
          new InitiateAuthCommand({
            ClientId: this.clientId,
            AuthFlow: AuthFlowType.CUSTOM_AUTH,
            AuthParameters: {
              USERNAME: user.handle,
            },
          })
        );

        if (!authResult.Session) {
          throw new Error('Failed to get auth session');
        }

        authSession = authResult.Session;
      }

      // Respond to the SMS challenge using the session we obtained
      const challengeResult = await this.cognitoClient.send(
        new RespondToAuthChallengeCommand({
          ClientId: this.clientId,
          ChallengeName: ChallengeNameType.CUSTOM_CHALLENGE,
          Session: authSession,
          ChallengeResponses: {
            USERNAME: user.handle,
            ANSWER: code,
          },
        })
      );

      if (!challengeResult.AuthenticationResult) {
        throw new Error('Authentication failed');
      }

      // Update last login time (reuse the user variable from above)
      await this.userRepository.updateUser(user.userId, {
        lastLoginAt: new Date().toISOString(),
      });

      // Clear the used session (cleanup)
      this.clearAuthSession(user.handle, phoneNumber);

      this.logger.log(`Signin successful for phone: ${phoneNumber}`);

      return {
        accessToken: challengeResult.AuthenticationResult.AccessToken!,
        refreshToken: challengeResult.AuthenticationResult.RefreshToken!,
        idToken: challengeResult.AuthenticationResult.IdToken!,
        expiresIn: challengeResult.AuthenticationResult.ExpiresIn!,
        tokenType: challengeResult.AuthenticationResult.TokenType!,
      };
    } catch (error) {
      this.logger.error(`Signin confirmation failed: ${phoneNumber}`, error);
      throw this.handleCognitoError(error);
    }
  }

  async refreshTokens(refreshToken: string): Promise<CognitoAuthResult> {
    try {
      const authResult = await this.cognitoClient.send(
        new InitiateAuthCommand({
          ClientId: this.clientId,
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
          },
        })
      );

      if (!authResult.AuthenticationResult) {
        throw new Error('Token refresh failed');
      }

      return {
        accessToken: authResult.AuthenticationResult.AccessToken!,
        refreshToken: refreshToken, // Refresh token doesn't change
        idToken: authResult.AuthenticationResult.IdToken!,
        expiresIn: authResult.AuthenticationResult.ExpiresIn!,
        tokenType: authResult.AuthenticationResult.TokenType!,
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      throw this.handleCognitoError(error);
    }
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      // Verify JWT token (Cognito tokens are self-verifying)
      const decoded = this.jwtService.decode(token) as JwtPayload;
      
      if (!decoded || !decoded.sub) {
        throw new Error('Invalid token');
      }

      // Check if token is expired
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      return decoded;
    } catch (error) {
      this.logger.error('Token validation failed', error);
      throw new HttpException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
        { cause: { errorCode: AuthErrorCode.INVALID_TOKEN } }
      );
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await this.cognitoClient.send(
        new GlobalSignOutCommand({
          AccessToken: token,
        })
      );
      this.logger.log('Token revoked successfully');
    } catch (error) {
      this.logger.error('Token revocation failed', error);
      throw this.handleCognitoError(error);
    }
  }

  private generateTemporaryPassword(): string {
    // Generate a secure temporary password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private extractSubFromToken(token: string): string {
    const decoded = this.jwtService.decode(token) as JwtPayload;
    return decoded.sub;
  }

  private handleCognitoError(error: any): HttpException {
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
    };

    const errorInfo = errorMap[error.name] || {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'COGNITO_ERROR',
      message: error.message || 'Authentication error',
    };

    return new HttpException(
      errorInfo.message,
      errorInfo.status,
      { cause: { errorCode: errorInfo.code } }
    );
  }
}
