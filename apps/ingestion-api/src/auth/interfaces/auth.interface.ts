export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
}

export interface CognitoUser {
  sub: string;
  phone_number: string;
  'custom:tiktok_handle': string;
  phone_number_verified: boolean;
}

export interface CognitoAuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface CognitoChallenge {
  challengeName: string;
  session: string;
  challengeParameters?: Record<string, string>;
}

export interface AuthSession {
  session: string;
  challengeName?: string;
  challengeParameters?: Record<string, string>;
}

export interface JwtPayload {
  sub: string; // Cognito user ID
  phone_number: string;
  'custom:tiktok_handle': string;
  aud: string; // Client ID
  iss: string; // Issuer
  exp: number; // Expiration
  iat: number; // Issued at
  token_use: 'access' | 'id';
}

export interface AuthenticatedUser {
  userId: string;
  cognitoUserId: string;
  handle: string;
  phoneNumber: string;
  subscriptionStatus: string;
}

export interface SubscriptionRequiredException extends Error {
  name: 'SubscriptionRequiredException';
  message: string;
  subscriptionStatus: string;
  userId: string;
}

export interface TikTokProfileValidation {
  exists: boolean;
  profilePhotoUrl?: string;
  followerCount?: number;
  isVerified?: boolean;
  displayName?: string;
  error?: string;
}

export interface AuthServiceInterface {
  validateHandle(handle: string): Promise<TikTokProfileValidation>;
  initiateSignup(handle: string, phoneNumber: string): Promise<AuthSession>;
  confirmSignup(handle: string, phoneNumber: string, code: string): Promise<CognitoAuthResult>;
  initiateSignin(phoneNumber: string): Promise<AuthSession>;
  confirmSignin(phoneNumber: string, code: string): Promise<CognitoAuthResult>;
  refreshTokens(refreshToken: string): Promise<CognitoAuthResult>;
  validateToken(token: string): Promise<JwtPayload>;
  revokeToken(token: string): Promise<void>;
}

export interface UserRepositoryInterface {
  createUser(userData: any): Promise<any>;
  getUserById(userId: string): Promise<any>;
  getUserByHandle(handle: string): Promise<any>;
  getUserByPhone(phoneNumber: string): Promise<any>;
  getUserByCognitoId(cognitoUserId: string): Promise<any>;
  updateUser(userId: string, updates: any): Promise<any>;
  deleteUser(userId: string): Promise<boolean>;
}

// Error types
export enum AuthErrorCode {
  INVALID_HANDLE = 'INVALID_HANDLE',
  HANDLE_NOT_FOUND = 'HANDLE_NOT_FOUND',
  HANDLE_ALREADY_EXISTS = 'HANDLE_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS = 'PHONE_ALREADY_EXISTS',
  INVALID_CODE = 'INVALID_CODE',
  CODE_EXPIRED = 'CODE_EXPIRED',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: any;
}
