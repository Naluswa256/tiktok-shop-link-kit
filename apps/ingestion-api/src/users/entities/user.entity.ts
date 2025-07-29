export enum SubscriptionStatus {
  PENDING = 'pending',
  TRIAL = 'trial',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface User {
  userId: string; // UUID primary key
  handle: string; // TikTok handle (unique)
  phoneNumber?: string; // Phone number (unique) - Optional for password-based auth
  shopLink: string; // Generated shop link
  subscriptionStatus: SubscriptionStatus;
  profilePhotoUrl?: string;
  displayName?: string;
  followerCount?: number;
  isVerified?: boolean;
  cognitoUserId?: string; // Cognito user sub
  trialStartDate?: string; // ISO date string
  trialEndDate?: string; // ISO date string
  subscriptionStartDate?: string; // ISO date string
  subscriptionEndDate?: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  lastLoginAt?: string; // ISO date string
}

export interface CreateUserInput {
  handle: string;
  phoneNumber?: string; // Optional for password-based auth
  profilePhotoUrl?: string;
  displayName?: string;
  followerCount?: number;
  isVerified?: boolean;
  cognitoUserId?: string;
  subscriptionStatus?: SubscriptionStatus; // Add subscription status
  createdAt?: string; // Add created at
  trialEndsAt?: string; // Add trial end date
}

export interface UpdateUserInput {
  profilePhotoUrl?: string;
  displayName?: string;
  followerCount?: number;
  isVerified?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  lastLoginAt?: string;
}

export interface UserFilters {
  handle?: string;
  phoneNumber?: string;
  subscriptionStatus?: SubscriptionStatus;
  cognitoUserId?: string;
}

// DynamoDB table structure
export interface UserDynamoDBItem {
  PK: string; // USER#{userId}
  SK: string; // USER#{userId}
  GSI1PK: string; // HANDLE#{handle}
  GSI1SK: string; // USER#{userId}
  GSI2PK?: string; // PHONE#{phoneNumber} - Optional for password-based auth
  GSI2SK?: string; // USER#{userId} - Optional for password-based auth
  EntityType: string; // 'USER'
  userId: string;
  handle: string;
  phoneNumber?: string; // Optional for password-based auth
  shopLink: string;
  subscriptionStatus: string;
  profilePhotoUrl?: string;
  displayName?: string;
  followerCount?: number;
  isVerified?: boolean;
  cognitoUserId?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  TTL?: number; // For automatic cleanup if needed
}
