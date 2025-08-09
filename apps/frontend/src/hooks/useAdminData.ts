import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminUserListQuery, AdminStats, AdminUser, handleAdminApiError } from '@/lib/admin-api';
import { toast } from 'sonner';

// Query Keys
export const adminQueryKeys = {
  all: ['admin'] as const,
  users: () => [...adminQueryKeys.all, 'users'] as const,
  usersList: (query: AdminUserListQuery) => [...adminQueryKeys.users(), 'list', query] as const,
  userDetail: (userId: string) => [...adminQueryKeys.users(), 'detail', userId] as const,
  stats: () => [...adminQueryKeys.all, 'stats'] as const,
};

// Users List Hook
export const useAdminUsers = (query: AdminUserListQuery = {}) => {
  return useQuery({
    queryKey: adminQueryKeys.usersList(query),
    queryFn: () => adminApi.getUsers(query),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 2,
  });
};

// User Details Hook
export const useAdminUserDetails = (userId: string) => {
  return useQuery({
    queryKey: adminQueryKeys.userDetail(userId),
    queryFn: () => adminApi.getUserDetails(userId),
    enabled: !!userId,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
};

// Stats Hook
export const useAdminStats = () => {
  return useQuery({
    queryKey: adminQueryKeys.stats(),
    queryFn: () => adminApi.getStats(),
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // Refresh every 5 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });
};

// Export Users Hook
export const useExportUsers = () => {
  return useMutation({
    mutationFn: async (query: AdminUserListQuery = {}) => {
      const blob = await adminApi.exportUsers(query);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    },
    onSuccess: () => {
      toast.success('Users exported successfully');
    },
    onError: (error) => {
      const errorMessage = handleAdminApiError(error, 'Failed to export users');
      toast.error(errorMessage);
    },
  });
};

// Refresh Data Hook
export const useRefreshAdminData = () => {
  const queryClient = useQueryClient();

  const refreshUsers = (query?: AdminUserListQuery) => {
    if (query) {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.usersList(query) });
    } else {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.users() });
    }
  };

  const refreshStats = () => {
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.stats() });
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
  };

  return {
    refreshUsers,
    refreshStats,
    refreshAll,
  };
};

// Real-time Updates Hook (polling-based for now)
export const useAdminRealTimeUpdates = (enabled = true) => {
  const { refreshStats, refreshUsers } = useRefreshAdminData();

  // Auto-refresh stats every 30 seconds
  useQuery({
    queryKey: ['admin-realtime-stats'],
    queryFn: async () => {
      refreshStats();
      return true;
    },
    refetchInterval: enabled ? 30000 : false, // 30 seconds
    enabled,
    refetchOnWindowFocus: false,
  });

  // Auto-refresh users every 60 seconds
  useQuery({
    queryKey: ['admin-realtime-users'],
    queryFn: async () => {
      refreshUsers();
      return true;
    },
    refetchInterval: enabled ? 60000 : false, // 60 seconds
    enabled,
    refetchOnWindowFocus: false,
  });
};

// Health Check Hook
export const useAdminHealthCheck = () => {
  return useQuery({
    queryKey: ['admin-health'],
    queryFn: () => adminApi.healthCheck(),
    refetchInterval: 60000, // Check every minute
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

// Custom hook for managing user list state
export const useAdminUserList = () => {
  const [query, setQuery] = useState<AdminUserListQuery>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const { data, isLoading, error, refetch } = useAdminUsers(query);

  const updateQuery = (updates: Partial<AdminUserListQuery>) => {
    setQuery(prev => ({
      ...prev,
      ...updates,
      // Reset to page 1 when changing filters
      ...(updates.search !== undefined || updates.subscriptionStatus !== undefined ? { page: 1 } : {}),
    }));
  };

  const nextPage = () => {
    if (data?.pagination.hasNext) {
      updateQuery({ page: (query.page || 1) + 1 });
    }
  };

  const prevPage = () => {
    if (data?.pagination.hasPrev) {
      updateQuery({ page: Math.max((query.page || 1) - 1, 1) });
    }
  };

  const setPage = (page: number) => {
    updateQuery({ page });
  };

  const setSearch = (search: string) => {
    updateQuery({ search: search || undefined });
  };

  const setSubscriptionFilter = (subscriptionStatus: string) => {
    updateQuery({ subscriptionStatus: subscriptionStatus || undefined });
  };

  const setSorting = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    updateQuery({ sortBy: sortBy as any, sortOrder });
  };

  return {
    // Data
    users: data?.users || [],
    pagination: data?.pagination,
    query,
    
    // Loading states
    isLoading,
    error,
    
    // Actions
    updateQuery,
    nextPage,
    prevPage,
    setPage,
    setSearch,
    setSubscriptionFilter,
    setSorting,
    refetch,
  };
};


