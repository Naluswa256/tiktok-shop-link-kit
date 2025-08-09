import axios, { AxiosInstance } from 'axios';

// Types
export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  accessToken: string;
  expiresAt: string;
}

export interface AdminRefreshResponse {
  success: boolean;
  accessToken: string;
  expiresAt: string;
  refreshToken?: string;
}

export interface AdminUser {
  userId: string;
  handle: string;
  phoneNumber?: string;
  subscriptionStatus: 'trial' | 'active' | 'paid' | 'expired' | 'pending';
  trialExpiresAt?: string;
  subscriptionExpiresAt?: string;
  createdAt: string;
  lastLoginAt?: string;
  followerCount?: number;
  isVerified?: boolean;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface AdminUserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  subscriptionStatus?: string;
  sortBy?: 'createdAt' | 'handle' | 'subscriptionStatus';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminStats {
  totalUsers: number;
  trialCount: number;
  paidCount: number;
  expiredCount: number;
  pendingCount: number;
  signupsLast7Days: number;
  signupsLast30Days: number;
  activeTrials: number;
  expiredTrials: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// API Client Class
class AdminApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
      timeout: 30000,
      withCredentials: true, // Important for HttpOnly cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken && config.url?.startsWith('/admin/')) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for automatic token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          originalRequest.url?.startsWith('/admin/') &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          try {
            // Attempt to refresh token
            const newToken = await this.refreshToken();
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.clearToken();
            window.location.href = '/admin/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async login(credentials: AdminLoginRequest): Promise<AdminLoginResponse> {
    const response = await this.client.post<AdminLoginResponse>('/admin/login', credentials);
    
    if (response.data.success && response.data.accessToken) {
      this.setToken(response.data.accessToken);
    }
    
    return response.data;
  }

  async refreshToken(): Promise<string | null> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._performRefresh();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _performRefresh(): Promise<string | null> {
    try {
      const response = await this.client.post<AdminRefreshResponse>('/admin/refresh');
      
      if (response.data.success && response.data.accessToken) {
        this.setToken(response.data.accessToken);
        return response.data.accessToken;
      }
      
      return null;
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/admin/logout');
    } catch (error) {
      console.warn('Logout request failed, but clearing local token:', error);
    } finally {
      this.clearToken();
    }
  }

  // User management methods
  async getUsers(query: AdminUserListQuery = {}): Promise<AdminUserListResponse> {
    const params = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await this.client.get<AdminUserListResponse>(`/admin/users?${params}`);
    return response.data;
  }

  async getUserDetails(userId: string): Promise<any> {
    const response = await this.client.get<ApiResponse>(`/admin/users/${userId}`);
    return response.data;
  }

  async getStats(): Promise<AdminStats> {
    const response = await this.client.get<AdminStats>('/admin/stats');
    return response.data;
  }

  async exportUsers(query: AdminUserListQuery = {}): Promise<Blob> {
    const params = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await this.client.get(`/admin/users/export?${params}`, {
      responseType: 'blob',
    });
    
    return response.data;
  }

  // Token management
  setToken(token: string): void {
    this.accessToken = token;
  }

  clearToken(): void {
    this.accessToken = null;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/admin/health');
      return true;
    } catch {
      return false;
    }
  }

  // Silent refresh on app start
  async silentRefresh(): Promise<boolean> {
    try {
      const token = await this.refreshToken();
      return !!token;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const adminApi = new AdminApiClient();

// Error handling utility
export const handleAdminApiError = (error: any, fallbackMessage = 'An error occurred') => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return fallbackMessage;
};
