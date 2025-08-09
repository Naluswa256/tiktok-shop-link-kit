import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { adminApi, AdminLoginRequest, handleAdminApiError } from '@/lib/admin-api';
import { toast } from 'sonner';

interface AdminUser {
  username: string;
  role: string;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AdminLoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

interface AdminAuthProviderProps {
  children: ReactNode;
}

export const AdminAuthProvider: React.FC<AdminAuthProviderProps> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!admin;

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (credentials: AdminLoginRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const response = await adminApi.login(credentials);
      
      if (response.success) {
        // Extract username from credentials (since backend doesn't return user info)
        setAdmin({
          username: credentials.username,
          role: 'admin',
        });
        
        toast.success('Successfully logged in');
        return true;
      }
      
      toast.error('Login failed');
      return false;
    } catch (error) {
      const errorMessage = handleAdminApiError(error, 'Login failed');
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await adminApi.logout();
      setAdmin(null);
      toast.success('Successfully logged out');
    } catch (error) {
      // Even if logout fails on server, clear local state
      setAdmin(null);
      const errorMessage = handleAdminApiError(error, 'Logout completed locally');
      toast.warning(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Attempt silent refresh to check if we have valid session
      const isValid = await adminApi.silentRefresh();
      
      if (isValid) {
        // We have a valid session, but we need to get admin info
        // For now, we'll set a default admin user since we don't have user info endpoint
        setAdmin({
          username: 'admin', // This could be improved by adding a /admin/me endpoint
          role: 'admin',
        });
        return true;
      } else {
        setAdmin(null);
        return false;
      }
    } catch (error) {
      console.warn('Auth check failed:', error);
      setAdmin(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AdminAuthContextType = {
    admin,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

// Admin Route Guard Component
interface AdminRouteGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ 
  children, 
  fallback = <div>Loading...</div> 
}) => {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated) {
    // Redirect to admin login
    window.location.href = '/admin/login';
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
