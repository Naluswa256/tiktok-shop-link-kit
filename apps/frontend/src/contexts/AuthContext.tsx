import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';

interface User {
  id: string;
  phoneNumber: string;
  tiktokHandle: string;
  shopHandle: string;
  shopLink?: string;
  subscriptionStatus?: string;
  profilePhotoUrl?: string;
  displayName?: string;
  followerCount?: number;
  isVerified?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;

  // Authentication methods
  validateHandle: (handle: string) => Promise<any>;
  signup: (handle: string, phoneNumber: string) => Promise<any>;
  verifySignup: (handle: string, phoneNumber: string, code: string) => Promise<any>;
  signin: (phoneNumber: string) => Promise<any>;
  verifySignin: (phoneNumber: string, code: string) => Promise<any>;
  login: (userData: User, accessToken?: string) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth data on app load
    const storedUser = localStorage.getItem('buylink_user');
    const storedToken = localStorage.getItem('buylink_token');

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (error) {
        console.error('Error parsing stored auth data:', error);
        localStorage.removeItem('buylink_user');
        localStorage.removeItem('buylink_token');
      }
    }
    setIsLoading(false);
  }, []);

  // Authentication methods
  const validateHandle = async (handle: string) => {
    try {
      const response = await authApi.validateHandle({ handle });
      return response;
    } catch (error) {
      console.error('Handle validation failed:', error);
      throw error;
    }
  };

  const signup = async (handle: string, phoneNumber: string) => {
    try {
      const response = await authApi.signup({ handle, phoneNumber });
      return response;
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const verifySignup = async (handle: string, phoneNumber: string, code: string) => {
    try {
      const response = await authApi.verifySignup({ handle, phoneNumber, code });

      if (response.success && response.data) {
        // Convert API user data to our User interface
        const userData: User = {
          id: response.data.user.userId,
          phoneNumber: response.data.user.phoneNumber,
          tiktokHandle: response.data.user.handle,
          shopHandle: response.data.user.handle,
          shopLink: response.data.user.shopLink,
          subscriptionStatus: response.data.user.subscriptionStatus,
          createdAt: response.data.user.createdAt,
          profilePhotoUrl: response.data.user.profilePhotoUrl,
          displayName: response.data.user.displayName,
          followerCount: response.data.user.followerCount,
          isVerified: response.data.user.isVerified,
        };

        // Store auth data
        setUser(userData);
        setToken(response.data.accessToken);
        localStorage.setItem('buylink_user', JSON.stringify(userData));
        localStorage.setItem('buylink_token', response.data.accessToken);

        toast.success('Successfully signed up!');
      }

      return response;
    } catch (error) {
      console.error('Signup verification failed:', error);
      throw error;
    }
  };

  const signin = async (phoneNumber: string) => {
    try {
      const response = await authApi.signin({ phoneNumber });
      return response;
    } catch (error) {
      console.error('Signin failed:', error);
      throw error;
    }
  };

  const verifySignin = async (phoneNumber: string, code: string) => {
    try {
      const response = await authApi.verifySignin({ phoneNumber, code });

      if (response.success && response.data) {
        // Convert API user data to our User interface
        const userData: User = {
          id: response.data.user.userId,
          phoneNumber: response.data.user.phoneNumber,
          tiktokHandle: response.data.user.handle,
          shopHandle: response.data.user.handle,
          shopLink: response.data.user.shopLink,
          subscriptionStatus: response.data.user.subscriptionStatus,
          createdAt: response.data.user.createdAt,
          profilePhotoUrl: response.data.user.profilePhotoUrl,
          displayName: response.data.user.displayName,
          followerCount: response.data.user.followerCount,
          isVerified: response.data.user.isVerified,
        };

        // Store auth data
        setUser(userData);
        setToken(response.data.accessToken);
        localStorage.setItem('buylink_user', JSON.stringify(userData));
        localStorage.setItem('buylink_token', response.data.accessToken);

        toast.success('Successfully signed in!');
      }

      return response;
    } catch (error) {
      console.error('Signin verification failed:', error);
      throw error;
    }
  };

  const login = (userData: User, accessToken?: string) => {
    setUser(userData);
    localStorage.setItem('buylink_user', JSON.stringify(userData));

    if (accessToken) {
      setToken(accessToken);
      localStorage.setItem('buylink_token', accessToken);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('buylink_user');
    localStorage.removeItem('buylink_token');
  };

  const refreshAuth = async () => {
    if (!token) return;

    try {
      const response = await authApi.getProfile(token);
      if (response.success && response.data) {
        // Update user data from profile
        const userData: User = {
          id: response.data.userId,
          phoneNumber: response.data.phoneNumber,
          tiktokHandle: response.data.handle,
          shopHandle: response.data.handle,
          shopLink: response.data.shopLink,
          subscriptionStatus: response.data.subscriptionStatus,
          createdAt: response.data.createdAt,
        };

        setUser(userData);
        localStorage.setItem('buylink_user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Auth refresh failed:', error);
      // If refresh fails, logout user
      logout();
    }
  };

  const value = {
    user,
    isAuthenticated: !!user && !!token,
    token,
    isLoading,
    validateHandle,
    signup,
    verifySignup,
    signin,
    verifySignin,
    login,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};