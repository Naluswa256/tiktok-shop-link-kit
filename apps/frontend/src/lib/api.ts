// API Client for TikTok Commerce Authentication
import { toast } from 'sonner';
import {
  handleApiError as handleNetworkError,
  retryWithBackoff
} from './networkErrorHandler';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Types for API requests and responses (matching backend DTOs)
export interface ValidateHandleRequest {
  handle: string;
}

export interface HandleValidationData {
  exists: boolean;
  profilePhotoUrl?: string;
  followerCount?: number;
  isVerified?: boolean;
  displayName?: string;
}

export interface ValidateHandleResponse {
  success: boolean;
  data: HandleValidationData;
  message: string;
  timestamp: string;
  requestId: string;
}

// Password-based authentication types
export interface PasswordSignupRequest {
  handle: string;
  password: string;
}

export interface PasswordSigninRequest {
  handle: string;
  password: string;
}

// Legacy phone-based types (keeping for backward compatibility)
export interface SignupRequest {
  handle: string;
  phoneNumber: string;
}

export interface OtpData {
  message: string;
  session: string;
  codeDelivery: {
    deliveryMedium: string;
    destination: string;
  };
}

// Password-based signup response
export interface PasswordSignupResponse {
  success: boolean;
  data: {
    success: boolean;
    shopLink: string;
    message: string;
  };
  message: string;
  timestamp: string;
  requestId: string;
}

// Password-based signin response
export interface PasswordSigninResponse {
  success: boolean;
  data: {
    success: boolean;
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
    user: {
      handle: string;
      userId: string;
      subscriptionStatus: string;
    };
  };
  message: string;
  timestamp: string;
  requestId: string;
}

// Legacy phone-based signup response
export interface SignupResponse {
  success: boolean;
  data: OtpData;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface VerifySignupRequest {
  handle: string;
  phoneNumber: string;
  code: string;
}

export interface SigninRequest {
  phoneNumber: string;
}

export interface VerifySigninRequest {
  phoneNumber: string;
  code: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface UserData {
  userId: string;
  handle: string;
  phoneNumber: string;
  shopLink: string;
  subscriptionStatus: string;
  createdAt: string;
  profilePhotoUrl?: string;
  displayName?: string;
  followerCount?: number;
  isVerified?: boolean;
  lastLoginAt?: string;
}

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserData;
}

export interface VerifySignupResponse {
  success: boolean;
  data: AuthData;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface SigninResponse {
  success: boolean;
  data: OtpData;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface VerifySigninResponse {
  success: boolean;
  data: AuthData;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  message: string;
  timestamp: string;
  requestId: string;
}

export interface ProfileResponse {
  success: boolean;
  data: UserData;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface ApiError {
  success: false;
  message: string;
  errorCode?: string;
  timestamp: string;
  requestId: string;
  statusCode?: number;
}

// Shop-related types
export interface ShopAnalytics {
  total_views: number;
  views_today: number;
  views_this_week: number;
  views_this_month: number;
  recent_views: Array<{
    timestamp: string;
    referrer?: string;
    user_agent?: string;
  }>;
}

export interface ShopData {
  shopId: string;
  handle: string;
  shopLink: string;
  displayName?: string;
  profilePhotoUrl?: string;
  followerCount?: number;
  isVerified?: boolean;
  subscriptionStatus: string;
  createdAt: string;
  viewCount?: number;
  productCount?: number;
  phoneNumber?: string; // Owner-only
  phone?: string;       // Owner-only (alternative field name)
  updatedAt?: string;   // Owner-only
  analytics?: ShopAnalytics; // Owner-only
}

// Product-related types
export interface ThumbnailInfo {
  thumbnail_url: string;
  thumbnail_s3_key: string;
  frame_timestamp: number;
  frame_index: number;
  confidence_score: number;
  quality_score: number;
  detected_objects?: DetectedObject[];
  is_primary: boolean;
}

export interface DetectedObject {
  class_name: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AssembledProduct {
  seller_handle: string;
  video_id: string;
  title: string;
  price: number | null;
  sizes: string | null;
  tags: string[];
  thumbnails: ThumbnailInfo[];
  primary_thumbnail: ThumbnailInfo;
  confidence_score?: number;
  raw_caption?: string;
  processing_metadata: {
    video_duration: number;
    frames_analyzed: number;
    thumbnails_generated: number;
    processing_time_ms: number;
  };
  created_at: string;
  updated_at: string;
}

export interface ShopProductsResponse {
  products: AssembledProduct[];
  pagination: {
    hasMore: boolean;
    lastEvaluatedKey: string | null;
    count: number;
  };
  metadata: {
    sellerHandle: string;
    since: string | null;
    timestamp: string;
  };
}

// Subscription-related types
export interface SubscriptionStatus {
  status: 'trial' | 'paid' | 'expired';
  expiresAt: string;
  daysLeft?: number;
}

export interface SubscriptionStatusResponse {
  success: boolean;
  data: SubscriptionStatus;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface ShopResponse {
  success: boolean;
  data: ShopData;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface ProductsResponse {
  success: boolean;
  data: ShopProductsResponse;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface ProductResponse {
  success: boolean;
  data: AssembledProduct;
  message: string;
  timestamp: string;
  requestId: string;
}

// Generic API client function with network error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Check if user is offline before making request
  if (!navigator.onLine) {
    const error = handleNetworkError(
      new Error('No internet connection'),
      `API request to ${endpoint}`
    );
    throw error;
  }

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    // Use retry with backoff for network resilience
    return await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-JSON responses (like network errors)
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any;
            error.statusCode = response.status;
            throw error;
          }
          throw new Error('Invalid response format');
        }

        if (!response.ok) {
          // Handle API errors - backend returns structured error responses
          const error = data as ApiError;
          const apiError = new Error(error.message || `HTTP ${response.status}: ${response.statusText}`) as any;
          apiError.statusCode = response.status;
          apiError.originalError = error;
          throw apiError;
        }

        // Backend always returns { success: true, data: T, message: string, ... }
        if (!data.success) {
          const error = new Error(data.message || 'API request failed') as any;
          error.statusCode = response.status;
          error.originalError = data;
          throw error;
        }

        return data;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        // Handle fetch-specific errors
        if (fetchError?.name === 'AbortError') {
          const timeoutError = new Error('Request timed out') as any;
          timeoutError.isTimeoutError = true;
          throw timeoutError;
        }

        // Handle network errors
        if (fetchError?.message?.includes('fetch') || fetchError?.message?.includes('network')) {
          const networkError = new Error('Network error - please check your connection') as any;
          networkError.isNetworkError = true;
          networkError.originalError = fetchError;
          throw networkError;
        }

        throw fetchError;
      }
    }, 2); // Retry up to 2 times
  } catch (error) {
    // Handle and show appropriate error message
    const networkError = handleNetworkError(error, `API request to ${endpoint}`);
    throw networkError;
  }
}

// API functions
export const authApi = {
  // Validate TikTok handle - POST /auth/validate-handle
  validateHandle: async (request: ValidateHandleRequest): Promise<ValidateHandleResponse> => {
    return apiRequest<ValidateHandleResponse>('/auth/validate-handle', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Password-based signup - POST /auth/password/signup
  passwordSignup: async (request: PasswordSignupRequest): Promise<PasswordSignupResponse> => {
    return apiRequest<PasswordSignupResponse>('/auth/password/signup', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Password-based signin - POST /auth/password/signin
  passwordSignin: async (request: PasswordSigninRequest): Promise<PasswordSigninResponse> => {
    return apiRequest<PasswordSigninResponse>('/auth/password/signin', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Initiate signup (sends OTP) - POST /auth/signup
  signup: async (request: SignupRequest): Promise<SignupResponse> => {
    return apiRequest<SignupResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Verify signup with OTP - POST /auth/verify-signup
  verifySignup: async (request: VerifySignupRequest): Promise<VerifySignupResponse> => {
    return apiRequest<VerifySignupResponse>('/auth/verify-signup', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Initiate signin (sends OTP) - POST /auth/signin
  signin: async (request: SigninRequest): Promise<SigninResponse> => {
    return apiRequest<SigninResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Verify signin with OTP - POST /auth/verify-signin
  verifySignin: async (request: VerifySigninRequest): Promise<VerifySigninResponse> => {
    return apiRequest<VerifySigninResponse>('/auth/verify-signin', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Get user profile - GET /auth/profile (requires auth token)
  getProfile: async (token: string): Promise<ProfileResponse> => {
    return apiRequest<ProfileResponse>('/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Refresh token - POST /auth/refresh
  refreshToken: async (refreshToken: string): Promise<{ success: boolean; data: Partial<AuthData>; message: string }> => {
    return apiRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  // Sign out - POST /auth/signout (requires auth token)
  signout: async (token: string): Promise<{ success: boolean; data: null; message: string }> => {
    return apiRequest('/auth/signout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

// Shop API functions
export const shopApi = {
  // Get shop by handle - GET /shop/:handle (public endpoint)
  getShopByHandle: async (handle: string, token?: string): Promise<ShopResponse> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return apiRequest<ShopResponse>(`/shop/${handle}`, {
      method: 'GET',
      headers,
    });
  },

  // Get shop by handle for owner - GET /shop/:handle/owner (requires auth token)
  getShopByHandleOwner: async (handle: string, token: string): Promise<ShopResponse> => {
    return apiRequest<ShopResponse>(`/shop/${handle}/owner`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Track shop view - POST /shop/:handle/view (public endpoint)
  trackShopView: async (handle: string, trackingData?: { referrer?: string; userAgent?: string }): Promise<{ success: boolean; data: any; message: string }> => {
    return apiRequest(`/shop/${handle}/view`, {
      method: 'POST',
      body: JSON.stringify(trackingData || {}),
    });
  },

  // Get shop analytics - GET /shop/:handle/analytics (requires auth token)
  getShopAnalytics: async (handle: string, token: string): Promise<{ success: boolean; data: any; message: string }> => {
    return apiRequest(`/shop/${handle}/analytics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Get shop settings - GET /shop/:handle/settings (requires auth token)
  getShopSettings: async (handle: string, token: string): Promise<{ success: boolean; data: any; message: string }> => {
    return apiRequest(`/shop/${handle}/settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

// Product API functions
export const productApi = {
  // Get products for a shop - GET /shop/:handle/products
  getShopProducts: async (
    handle: string,
    options?: {
      limit?: number;
      lastKey?: string;
      since?: string;
    }
  ): Promise<ProductsResponse> => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.lastKey) params.append('lastKey', options.lastKey);
    if (options?.since) params.append('since', options.since);

    const queryString = params.toString();
    const endpoint = `/shop/${handle}/products${queryString ? `?${queryString}` : ''}`;

    return apiRequest<ProductsResponse>(endpoint, {
      method: 'GET',
    });
  },

  // Get specific product - GET /shop/:handle/products/:videoId
  getProduct: async (handle: string, videoId: string): Promise<ProductResponse> => {
    return apiRequest<ProductResponse>(`/shop/${handle}/products/${videoId}`, {
      method: 'GET',
    });
  },
};

// Subscription API functions
export const subscriptionApi = {
  // Get subscription status - GET /auth/subscription-status
  getSubscriptionStatus: async (token: string): Promise<SubscriptionStatusResponse> => {
    return apiRequest<SubscriptionStatusResponse>('/auth/subscription-status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Subscribe - POST /auth/subscribe
  subscribe: async (token: string): Promise<SubscriptionStatusResponse> => {
    return apiRequest<SubscriptionStatusResponse>('/auth/subscribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

// Helper function to handle API errors with toast notifications
export const handleApiError = (error: unknown, fallbackMessage = 'Something went wrong') => {
  const message = error instanceof Error ? error.message : fallbackMessage;
  toast.error(message);
  console.error('API Error:', error);
};

// Helper function to convert backend error messages to user-friendly messages
export const getUserFriendlyErrorMessage = (error: unknown, context: 'signin' | 'signup' | 'verify' = 'signin'): string => {
  if (!(error instanceof Error)) {
    return 'Something went wrong. Please try again.';
  }

  const errorMessage = error.message.toLowerCase();

  // Common error patterns and their user-friendly messages
  if (errorMessage.includes('user not found') || errorMessage.includes('404')) {
    return context === 'signin'
      ? 'Phone number not registered. Please sign up first.'
      : 'Account not found. Please check your details.';
  }

  if (errorMessage.includes('already exists') || errorMessage.includes('409')) {
    return context === 'signup'
      ? 'This phone number or TikTok handle is already registered. Try signing in instead.'
      : 'Account already exists.';
  }

  if (errorMessage.includes('invalid phone') || errorMessage.includes('phone')) {
    return 'Invalid phone number format. Please enter a valid phone number.';
  }

  if (errorMessage.includes('invalid handle') || errorMessage.includes('handle')) {
    return 'Invalid TikTok handle. Please check the handle and try again.';
  }

  if (errorMessage.includes('expired') || errorMessage.includes('invalid code')) {
    return 'Verification code has expired or is invalid. Please request a new code.';
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }

  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  if (errorMessage.includes('server') || errorMessage.includes('500')) {
    return 'Server error. Please try again in a few moments.';
  }

  if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
    return 'Session expired. Please sign in again.';
  }

  if (errorMessage.includes('forbidden') || errorMessage.includes('403')) {
    return 'Access denied. Please check your permissions.';
  }

  // Return the original message if no pattern matches, but make it more user-friendly
  return error.message || 'Something went wrong. Please try again.';
};

// Helper function to format phone numbers
export const formatPhoneNumber = (countryCode: string, phoneNumber: string): string => {
  // Remove any spaces or special characters from phone number
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  return `${countryCode}${cleanNumber}`;
};

// Helper function to clean TikTok handle
export const cleanTikTokHandle = (handle: string): string => {
  // Remove @ symbol if present and trim whitespace
  return handle.replace('@', '').trim();
};
