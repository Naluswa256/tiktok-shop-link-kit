import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  SignUpCommand,
  AdminConfirmSignUpCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { TikTokLookupService } from './tiktok-lookup.service';
import { UserRepository } from '../../users/repository/user.repository';
import { ShopService } from '../../shop/services/shop.service';
import {
  CognitoAuthResult,
  JwtPayload,
  AuthServiceInterface,
  TikTokProfileValidation,
  AuthErrorCode,
  SignupResponse,
  SigninResponse,
} from '../interfaces/auth.interface';
import { CreateUserInput, SubscriptionStatus } from '../../users/entities/user.entity';

// Cache for validated handles to avoid re-validation and save Apify credits
interface HandleValidationCache {
  result: TikTokProfileValidation;
  timestamp: number;
  expiresAt: number;
}

// Cache for validated tokens to improve performance
interface TokenValidationCache {
  payload: JwtPayload;
  timestamp: number;
  expiresAt: number;
}

// Rate limiting for failed token validations
interface TokenValidationAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

@Injectable()
export class AuthService implements AuthServiceInterface {
  private readonly logger = new Logger(AuthService.name);
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly clientSecret?: string;
  private readonly region: string;
  private readonly jwksClient: jwksClient.JwksClient;

  // In-memory caches (use Redis in production)
  private readonly handleValidationCache = new Map<string, HandleValidationCache>();
  private readonly tokenValidationCache = new Map<string, TokenValidationCache>();
  private readonly tokenValidationAttempts = new Map<string, TokenValidationAttempt>();
  private readonly HANDLE_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly TOKEN_CACHE_TIMEOUT = 2 * 60 * 1000; // 2 minutes
  private readonly MAX_VALIDATION_ATTEMPTS = 10; // Max attempts per IP/token
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly tiktokLookupService: TikTokLookupService,
    private readonly userRepository: UserRepository,
    private readonly shopService: ShopService,
  ) {
    this.region = this.configService.get('AWS_REGION', 'us-east-1');
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.region,
    });

    this.userPoolId = this.configService.get('COGNITO_USER_POOL_ID');
    this.clientId = this.configService.get('COGNITO_CLIENT_ID');
    this.clientSecret = this.configService.get('COGNITO_CLIENT_SECRET');

    if (!this.userPoolId || !this.clientId) {
      throw new Error('Cognito configuration is missing');
    }

    // Debug logging for client secret configuration
    this.logger.log(`Cognito configuration loaded:`, {
      userPoolId: this.userPoolId,
      clientId: this.clientId,
      hasClientSecret: !!this.clientSecret,
      clientSecretLength: this.clientSecret ? this.clientSecret.length : 0,
    });

    // Initialize JWKS client for token verification
    this.jwksClient = jwksClient({
      jwksUri: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });

    // Start periodic cleanup
    setInterval(() => {
      this.cleanupExpiredValidations();
    }, 5 * 60 * 1000); // Every 5 minutes
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

  private cacheTokenValidation(token: string, payload: JwtPayload): void {
    // Create a hash of the token for cache key (don't store full token for security)
    const tokenHash = this.createTokenHash(token);
    const now = Date.now();

    // Cache for shorter time than token expiry to ensure freshness
    const cacheExpiry = Math.min(
      now + this.TOKEN_CACHE_TIMEOUT,
      (payload.exp * 1000) - 30000 // 30 seconds before token expires
    );

    this.tokenValidationCache.set(tokenHash, {
      payload,
      timestamp: now,
      expiresAt: cacheExpiry,
    });
  }

  private getCachedTokenValidation(token: string): JwtPayload | null {
    const tokenHash = this.createTokenHash(token);
    const cached = this.tokenValidationCache.get(tokenHash);

    if (!cached || Date.now() > cached.expiresAt) {
      this.tokenValidationCache.delete(tokenHash);
      return null;
    }

    return cached.payload;
  }

  private createTokenHash(token: string): string {
    // Create a simple hash of the token for cache key
    // In production, consider using a proper hash function
    return Buffer.from(token).toString('base64').substring(0, 32);
  }

  /**
   * Calculate SECRET_HASH for Cognito API calls when client secret is configured
   * Formula: Base64(HMAC_SHA256("Client Secret Key", "Username" + "Client Id"))
   */
  private calculateSecretHash(username: string): string | undefined {
    if (!this.clientSecret) {
      this.logger.debug('No client secret configured, skipping SECRET_HASH calculation');
      return undefined; // No secret hash needed for public clients
    }

    const message = username + this.clientId;
    const hmac = crypto.createHmac('sha256', this.clientSecret);
    hmac.update(message);
    const secretHash = hmac.digest('base64');

    this.logger.debug(`SECRET_HASH calculated for user: ${username}`, {
      messageLength: message.length,
      secretHashLength: secretHash.length,
      // Don't log the actual values for security
    });

    return secretHash;
  }

  private cleanupExpiredValidations(): void {
    const now = Date.now();
    let cleanedHandleValidations = 0;
    let cleanedTokenValidations = 0;

    // Clean expired handle validations
    for (const [key, validation] of this.handleValidationCache.entries()) {
      if (now > validation.expiresAt) {
        this.handleValidationCache.delete(key);
        cleanedHandleValidations++;
      }
    }

    // Clean expired token validations
    for (const [key, validation] of this.tokenValidationCache.entries()) {
      if (now > validation.expiresAt) {
        this.tokenValidationCache.delete(key);
        cleanedTokenValidations++;
      }
    }

    if (cleanedHandleValidations > 0 || cleanedTokenValidations > 0) {
      this.logger.debug(`Cleaned up ${cleanedHandleValidations} expired handle validations and ${cleanedTokenValidations} expired token validations`);
    }
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

      // Validate handle with TikTok (only if not cached) - optimized for speed
      this.logger.log(`Performing ultra-fast validation for handle: ${handle}`);
      const result = await this.tiktokLookupService.validateHandle(handle);

      if (!result.exists) {
        throw new HttpException(
          'TikTok handle not found. Please check the handle and try again.',
          HttpStatus.NOT_FOUND,
          { cause: { errorCode: AuthErrorCode.HANDLE_NOT_FOUND } }
        );
      }

      // Try to get detailed profile data if available from background collection
      const detailedData = this.tiktokLookupService.getCachedProfileData(handle);
      const finalResult = detailedData || result;

      // Cache the successful validation
      this.cacheHandleValidation(handle, finalResult);
      this.logger.log(`Ultra-fast handle validation successful and cached: ${handle}`);

      return finalResult;
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

  /**
   * Password-based signup - creates user account with handle and password
   */
  async signup(handle: string, password: string): Promise<SignupResponse> {
    try {
      this.logger.log(`Starting password-based signup for handle: ${handle}`);

      // Validate handle first - this will throw an error if handle doesn't exist on TikTok
      // or if it's already registered in our database
      const handleValidation = await this.validateHandle(handle);
      this.logger.log(`Handle validation successful for ${handle}:`, {
        exists: handleValidation.exists,
        verified: handleValidation.isVerified,
        followers: handleValidation.followerCount
      });

      // Create user in Cognito using SignUp (standard flow)
      const signUpParams: any = {
        ClientId: this.clientId,
        Username: handle, // Use handle as username
        Password: password,
        // Remove UserAttributes to avoid permission issues
        // The username field will store the handle
      };

      // Add SECRET_HASH if client secret is configured
      const secretHash = this.calculateSecretHash(handle);
      if (secretHash) {
        signUpParams.SecretHash = secretHash;
      }

      const signUpCommand = new SignUpCommand(signUpParams);

      const signUpResult = await this.cognitoClient.send(signUpCommand);
      this.logger.log(`Cognito signup successful for handle: ${handle}`, {
        userSub: signUpResult.UserSub,
        confirmed: signUpResult.UserConfirmed,
      });

      // Auto-confirm the user since we're not using email verification
      if (!signUpResult.UserConfirmed) {
        try {
          const confirmParams = {
            UserPoolId: this.userPoolId,
            Username: handle,
          };

          const confirmCommand = new AdminConfirmSignUpCommand(confirmParams);
          await this.cognitoClient.send(confirmCommand);
          this.logger.log(`User auto-confirmed for handle: ${handle}`);
        } catch (confirmError) {
          this.logger.error(`Failed to auto-confirm user ${handle}:`, confirmError);
          // Don't throw here - the user was created successfully, they just need manual confirmation
          this.logger.warn(`User ${handle} created but not confirmed - they may need to verify their account`);
        }
      }

      // Create user record in DynamoDB
      const userData: CreateUserInput = {
        cognitoUserId: signUpResult.UserSub!,
        handle,
        subscriptionStatus: SubscriptionStatus.TRIAL,
        createdAt: new Date().toISOString(),
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      };

      const user = await this.userRepository.createUser(userData);
      this.logger.log(`User created in database:`, { userId: user.userId, handle });

      // Create shop record
      await this.shopService.createShop({
        handle,
        user_id: user.userId,
        subscription_status: 'trial',
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      const shopLink = `/shop/${handle}`;
      this.logger.log(`Shop created successfully for handle: ${handle}`);

      return {
        success: true,
        shopLink,
        message: 'Account created successfully! Your shop is ready.',
      };
    } catch (error) {
      this.logger.error(`Signup failed for handle: ${handle}`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle Cognito-specific errors
      if (error.name === 'UsernameExistsException') {
        throw new HttpException(
          'This handle is already taken',
          HttpStatus.CONFLICT,
          { cause: { errorCode: AuthErrorCode.USERNAME_EXISTS } }
        );
      }

      if (error.name === 'InvalidPasswordException') {
        throw new HttpException(
          'Password does not meet requirements',
          HttpStatus.BAD_REQUEST,
          { cause: { errorCode: AuthErrorCode.PASSWORD_TOO_WEAK } }
        );
      }

      throw new HttpException(
        'Signup failed. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: { errorCode: AuthErrorCode.SERVICE_UNAVAILABLE } }
      );
    }
  }

  /**
   * Password-based signin - authenticates user with handle and password
   */
  async signin(handle: string, password: string): Promise<SigninResponse> {
    try {
      this.logger.log(`Starting password-based signin for handle: ${handle}`);

      // Authenticate with Cognito
      const authParameters: any = {
        USERNAME: handle,
        PASSWORD: password,
      };

      // Add SECRET_HASH if client secret is configured
      const secretHash = this.calculateSecretHash(handle);
      if (secretHash) {
        authParameters.SECRET_HASH = secretHash;
      }

      const authCommand = new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: authParameters,
      });

      const authResult = await this.cognitoClient.send(authCommand);
      
      if (!authResult.AuthenticationResult) {
        throw new HttpException(
          'Authentication failed',
          HttpStatus.UNAUTHORIZED,
          { cause: { errorCode: AuthErrorCode.INVALID_CREDENTIALS } }
        );
      }

      const { AccessToken, RefreshToken, IdToken, ExpiresIn } = authResult.AuthenticationResult;

      // Get user from database
      const user = await this.userRepository.getUserByHandle(handle);
      if (!user) {
        throw new HttpException(
          'User not found',
          HttpStatus.NOT_FOUND,
          { cause: { errorCode: AuthErrorCode.USER_NOT_FOUND } }
        );
      }

      this.logger.log(`Signin successful for handle: ${handle}`, {
        userId: user.userId,
        subscriptionStatus: user.subscriptionStatus,
      });

      return {
        success: true,
        accessToken: AccessToken!,
        refreshToken: RefreshToken!,
        idToken: IdToken!,
        expiresIn: ExpiresIn!,
        user: {
          handle: user.handle,
          userId: user.userId,
          subscriptionStatus: user.subscriptionStatus,
        },
      };
    } catch (error) {
      this.logger.error(`Signin failed for handle: ${handle}`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle Cognito-specific errors
      if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
        throw new HttpException(
          'Invalid handle or password',
          HttpStatus.UNAUTHORIZED,
          { cause: { errorCode: AuthErrorCode.INVALID_CREDENTIALS } }
        );
      }

      if (error.name === 'UserNotConfirmedException') {
        // Try to auto-confirm the user (for existing users created before auto-confirmation was implemented)
        try {
          this.logger.log(`Attempting to auto-confirm unconfirmed user: ${handle}`);
          const confirmParams = {
            UserPoolId: this.userPoolId,
            Username: handle,
          };

          const confirmCommand = new AdminConfirmSignUpCommand(confirmParams);
          await this.cognitoClient.send(confirmCommand);
          this.logger.log(`User auto-confirmed during signin: ${handle}`);

          // Retry the authentication after confirmation
          const retryAuthCommand = new InitiateAuthCommand({
            ClientId: this.clientId,
            AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
            AuthParameters: {
              USERNAME: handle,
              PASSWORD: password,
              ...(this.calculateSecretHash(handle) && { SECRET_HASH: this.calculateSecretHash(handle) }),
            },
          });

          const retryAuthResult = await this.cognitoClient.send(retryAuthCommand);

          if (retryAuthResult.AuthenticationResult) {
            const { AccessToken, RefreshToken, IdToken, ExpiresIn } = retryAuthResult.AuthenticationResult;

            // Get user from database
            const user = await this.userRepository.getUserByHandle(handle);
            if (!user) {
              throw new HttpException(
                'User not found in database',
                HttpStatus.NOT_FOUND,
                { cause: { errorCode: AuthErrorCode.USER_NOT_FOUND } }
              );
            }

            this.logger.log(`Signin successful after auto-confirmation for handle: ${handle}`);

            return {
              success: true,
              accessToken: AccessToken!,
              refreshToken: RefreshToken!,
              idToken: IdToken!,
              expiresIn: ExpiresIn!,
              user: {
                handle: user.handle,
                userId: user.userId,
                subscriptionStatus: user.subscriptionStatus,
              },
            };
          }
        } catch (confirmError) {
          this.logger.error(`Failed to auto-confirm user during signin: ${handle}`, confirmError);
        }

        throw new HttpException(
          'Account not confirmed. Please contact support for assistance.',
          HttpStatus.UNAUTHORIZED,
          { cause: { errorCode: AuthErrorCode.USER_NOT_FOUND } }
        );
      }

      throw new HttpException(
        'Signin failed. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: { errorCode: AuthErrorCode.SERVICE_UNAVAILABLE } }
      );
    }
  }

  async refreshTokens(refreshToken: string, username?: string): Promise<CognitoAuthResult> {
    try {
      const authParameters: any = {
        REFRESH_TOKEN: refreshToken,
      };

      // Add SECRET_HASH if client secret is configured
      // For refresh token flow, we need the username from the original token
      if (this.clientSecret && username) {
        const secretHash = this.calculateSecretHash(username);
        if (secretHash) {
          authParameters.SECRET_HASH = secretHash;
        }
      }

      const authResult = await this.cognitoClient.send(
        new InitiateAuthCommand({
          ClientId: this.clientId,
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          AuthParameters: authParameters,
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
      throw new HttpException(
        'Token refresh failed',
        HttpStatus.UNAUTHORIZED,
        { cause: { errorCode: AuthErrorCode.INVALID_TOKEN } }
      );
    }
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      // Check cache first to avoid expensive verification
      const cachedValidation = this.getCachedTokenValidation(token);
      if (cachedValidation) {
        this.logger.debug('Using cached token validation');
        return cachedValidation;
      }

      // Decode the token header to get the key ID (kid)
      const decodedHeader = jwt.decode(token, { complete: true });

      if (!decodedHeader || !decodedHeader.header || !decodedHeader.header.kid) {
        throw new Error('Invalid token: missing key ID');
      }

      // Get the signing key from Cognito's JWKS
      const key = await this.getSigningKey(decodedHeader.header.kid);

      // Verify the token using the public key
      const decoded = jwt.verify(token, key, {
        algorithms: ['RS256'],
      }) as any;

      // Validate token structure and claims
      if (!decoded || !decoded.sub) {
        throw new Error('Invalid token structure');
      }

      // Perform additional security validations
      this.validateTokenClaims(decoded);

      const payload: JwtPayload = {
        sub: decoded.sub,
        preferred_username: decoded.username || decoded.preferred_username, // Use username as primary source
        aud: decoded.aud,
        iss: decoded.iss,
        exp: decoded.exp,
        iat: decoded.iat,
        token_use: decoded.token_use,
      };

      // Cache the validated token for performance
      this.cacheTokenValidation(token, payload);

      this.logger.debug('Token validation successful', {
        sub: decoded.sub,
        username: decoded.username || decoded.preferred_username,
        exp: decoded.exp,
        token_use: decoded.token_use,
      });

      return payload;
    } catch (error) {
      this.logger.error('Token validation failed', {
        error: error.message,
        tokenPreview: token.substring(0, 20) + '...',
      });

      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        throw new HttpException(
          'Token has expired',
          HttpStatus.UNAUTHORIZED,
          { cause: { errorCode: AuthErrorCode.TOKEN_EXPIRED } }
        );
      }

      if (error.name === 'JsonWebTokenError') {
        throw new HttpException(
          'Invalid token format',
          HttpStatus.UNAUTHORIZED,
          { cause: { errorCode: AuthErrorCode.INVALID_TOKEN } }
        );
      }

      throw new HttpException(
        'Token validation failed',
        HttpStatus.UNAUTHORIZED,
        { cause: { errorCode: AuthErrorCode.INVALID_TOKEN } }
      );
    }
  }

  /**
   * Get the signing key from Cognito's JWKS endpoint
   */
  private async getSigningKey(kid: string): Promise<string> {
    try {
      const key = await this.jwksClient.getSigningKey(kid);
      return key.getPublicKey();
    } catch (error) {
      this.logger.error('Failed to get signing key', {
        kid,
        error: error.message,
      });
      throw new Error('Failed to get signing key for token verification');
    }
  }

  /**
   * Validate additional token claims for security
   */
  private validateTokenClaims(decoded: any): void {
    // Validate issuer
    const expectedIssuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
    if (decoded.iss !== expectedIssuer) {
      throw new Error(`Invalid issuer: expected ${expectedIssuer}, got ${decoded.iss}`);
    }

    // Validate audience (client ID)
    if (decoded.aud !== this.clientId) {
      throw new Error(`Invalid audience: expected ${this.clientId}, got ${decoded.aud}`);
    }

    // Validate token use
    if (decoded.token_use !== 'access') {
      throw new Error(`Invalid token use: expected 'access', got ${decoded.token_use}`);
    }

    // Validate expiration
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp < now) {
      throw new Error('Token has expired');
    }

    // Validate issued at time (not too far in the future)
    if (decoded.iat && decoded.iat > now + 300) { // 5 minutes tolerance
      throw new Error('Token issued in the future');
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
      throw new HttpException(
        'Token revocation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: { errorCode: AuthErrorCode.SERVICE_UNAVAILABLE } }
      );
    }
  }
}