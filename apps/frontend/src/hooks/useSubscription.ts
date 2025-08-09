import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { subscriptionApi, SubscriptionStatus } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Query keys for subscription
export const subscriptionKeys = {
  all: ['subscription'] as const,
  status: () => [...subscriptionKeys.all, 'status'] as const,
};

// Hook to get subscription status
export const useSubscriptionStatus = () => {
  const { token } = useAuth();

  return useQuery({
    queryKey: subscriptionKeys.status(),
    queryFn: () => {
      if (!token) throw new Error('No authentication token');
      return subscriptionApi.getSubscriptionStatus(token);
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's an auth error
      if (error?.message?.includes('401') || error?.message?.includes('unauthorized')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

// Hook to subscribe
export const useSubscribe = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => {
      if (!token) throw new Error('No authentication token');
      return subscriptionApi.subscribe(token);
    },
    onSuccess: (response) => {
      // Update the subscription status cache
      queryClient.setQueryData(subscriptionKeys.status(), response);
      
      toast.success('Subscription activated successfully!');
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['shops'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      console.error('Subscription failed:', error);
      toast.error('Failed to activate subscription. Please try again.');
    },
  });
};

// Hook to check subscription and redirect if needed
export const useSubscriptionGuard = () => {
  const navigate = useNavigate();
  const { data: subscriptionData, isLoading, error } = useSubscriptionStatus();

  const checkSubscription = (redirectPath?: string) => {
    if (isLoading) return { allowed: false, loading: true };
    
    if (error) {
      console.error('Subscription check failed:', error);
      return { allowed: false, loading: false, error: 'Failed to check subscription status' };
    }

    if (!subscriptionData?.data) {
      return { allowed: false, loading: false, error: 'No subscription data' };
    }

    const { status } = subscriptionData.data;
    
    if (status === 'expired') {
      if (redirectPath) {
        navigate('/subscription', { 
          state: { 
            returnTo: redirectPath,
            reason: 'subscription_expired' 
          } 
        });
      }
      return { allowed: false, loading: false, expired: true };
    }

    return { 
      allowed: true, 
      loading: false, 
      subscriptionStatus: subscriptionData.data 
    };
  };

  return { checkSubscription, subscriptionData: subscriptionData?.data };
};

// Hook to calculate days left in trial/subscription
export const useSubscriptionTimer = () => {
  const { data: subscriptionData } = useSubscriptionStatus();

  const getTimeLeft = () => {
    if (!subscriptionData?.data?.expiresAt) return null;

    const expiresAt = new Date(subscriptionData.data.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    
    if (diffMs <= 0) return { expired: true, days: 0, hours: 0, minutes: 0 };

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return { expired: false, days, hours, minutes };
  };

  const formatTimeLeft = () => {
    const timeLeft = getTimeLeft();
    if (!timeLeft) return null;
    
    if (timeLeft.expired) return 'Expired';
    
    if (timeLeft.days > 0) {
      return `${timeLeft.days} day${timeLeft.days !== 1 ? 's' : ''} left`;
    } else if (timeLeft.hours > 0) {
      return `${timeLeft.hours} hour${timeLeft.hours !== 1 ? 's' : ''} left`;
    } else {
      return `${timeLeft.minutes} minute${timeLeft.minutes !== 1 ? 's' : ''} left`;
    }
  };

  return {
    timeLeft: getTimeLeft(),
    formatTimeLeft: formatTimeLeft(),
    subscriptionStatus: subscriptionData?.data,
  };
};

// Hook for trial expiry monitoring
export const useTrialExpiryMonitor = () => {
  const { timeLeft, subscriptionStatus } = useSubscriptionTimer();
  const navigate = useNavigate();

  const checkForExpiry = () => {
    if (!subscriptionStatus || !timeLeft) return false;

    // If expired and was on trial, show modal
    if (timeLeft.expired && subscriptionStatus.status === 'trial') {
      return true;
    }

    // If less than 1 hour left on trial, show warning
    if (subscriptionStatus.status === 'trial' && timeLeft.days === 0 && timeLeft.hours === 0) {
      return 'warning';
    }

    return false;
  };

  const handleExpiry = () => {
    navigate('/subscription', {
      state: {
        reason: 'trial_expired',
        message: 'Your free trial has expired. Please subscribe to continue.'
      }
    });
  };

  return {
    isExpired: checkForExpiry() === true,
    isWarning: checkForExpiry() === 'warning',
    handleExpiry,
    timeLeft,
    subscriptionStatus,
  };
};
