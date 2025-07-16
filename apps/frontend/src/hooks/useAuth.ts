// React Query hooks for authentication flow
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  authApi, 
  handleApiError, 
  ValidateHandleRequest, 
  SignupRequest, 
  VerifySignupRequest,
  cleanTikTokHandle,
  formatPhoneNumber
} from '@/lib/api';
import { useAuth as useAuthContext } from '@/contexts/AuthContext';

// Hook for validating TikTok handle
export const useValidateHandle = () => {
  return useMutation({
    mutationFn: async (handle: string) => {
      const cleanHandle = cleanTikTokHandle(handle);
      if (!cleanHandle) {
        throw new Error('Please enter a valid TikTok handle');
      }
      
      const request: ValidateHandleRequest = { handle: cleanHandle };
      return authApi.validateHandle(request);
    },
    onError: (error) => {
      handleApiError(error, 'Failed to validate TikTok handle');
    },
  });
};

// Hook for initiating signup (sending OTP)
export const useSignup = () => {
  return useMutation({
    mutationFn: async ({ handle, phoneNumber, countryCode }: { 
      handle: string; 
      phoneNumber: string; 
      countryCode: string; 
    }) => {
      const cleanHandle = cleanTikTokHandle(handle);
      const fullPhoneNumber = formatPhoneNumber(countryCode, phoneNumber);
      
      if (!cleanHandle) {
        throw new Error('Please enter a valid TikTok handle');
      }
      
      if (!phoneNumber || phoneNumber.length < 9) {
        throw new Error('Please enter a valid phone number');
      }
      
      const request: SignupRequest = { 
        handle: cleanHandle, 
        phoneNumber: fullPhoneNumber 
      };
      return authApi.signup(request);
    },
    onSuccess: (response, variables) => {
      // Use the masked phone number from the response for better UX
      const maskedPhone = response.data.codeDelivery.destination;
      toast.success(`OTP sent to ${maskedPhone}`);
    },
    onError: (error) => {
      handleApiError(error, 'Failed to send verification code');
    },
  });
};

// Hook for verifying signup with OTP
export const useVerifySignup = () => {
  const navigate = useNavigate();
  const { login } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ handle, phoneNumber, countryCode, code }: {
      handle: string;
      phoneNumber: string;
      countryCode: string;
      code: string;
    }) => {
      const cleanHandle = cleanTikTokHandle(handle);
      const fullPhoneNumber = formatPhoneNumber(countryCode, phoneNumber);

      if (!code || code.length !== 6) {
        throw new Error('Please enter a valid 6-digit verification code');
      }

      const request: VerifySignupRequest = {
        handle: cleanHandle,
        phoneNumber: fullPhoneNumber,
        code
      };
      return authApi.verifySignup(request);
    },
    onSuccess: (response, variables) => {
      // Store auth tokens securely
      localStorage.setItem('buylink_access_token', response.data.accessToken);
      localStorage.setItem('buylink_refresh_token', response.data.refreshToken);

      // Update auth context with data from backend
      const userData = {
        id: response.data.user.userId,
        phoneNumber: response.data.user.phoneNumber,
        tiktokHandle: response.data.user.handle,
        shopHandle: response.data.user.handle,
      };

      login(userData);

      // Clear any cached data
      queryClient.clear();

      toast.success('Account created successfully!');

      // Navigate to shop page to check subscription status
      navigate(`/shop/${response.data.user.handle}`);
    },
    onError: (error) => {
      handleApiError(error, 'Failed to verify code');
    },
  });
};

// Hook for checking if user needs subscription
export const useCheckSubscription = () => {
  const navigate = useNavigate();
  
  return {
    checkAndPromptSubscription: (handle: string) => {
      // For now, we'll assume all new users need subscription
      // In a real app, this would check the user's subscription status
      const isFirstTime = !localStorage.getItem('buylink_subscription_checked');
      
      if (isFirstTime) {
        // Mark as checked
        localStorage.setItem('buylink_subscription_checked', 'true');
        
        // Navigate to subscription page
        navigate('/subscription', { 
          state: { 
            fromSignup: true, 
            handle,
            returnTo: `/shop/${handle}` 
          } 
        });
        return true;
      }
      
      return false;
    }
  };
};

// Hook for signing out
export const useSignout = () => {
  const { logout } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('buylink_access_token');
      if (token) {
        await authApi.signout(token);
      }
    },
    onSuccess: () => {
      // Clear all stored data
      localStorage.removeItem('buylink_access_token');
      localStorage.removeItem('buylink_refresh_token');
      localStorage.removeItem('buylink_user');
      localStorage.removeItem('buylink_trial_started');
      localStorage.removeItem('buylink_trial_start_date');

      // Clear auth context
      logout();

      // Clear React Query cache
      queryClient.clear();

      toast.success('Signed out successfully');
      navigate('/');
    },
    onError: (error) => {
      // Even if API call fails, clear local data
      localStorage.removeItem('buylink_access_token');
      localStorage.removeItem('buylink_refresh_token');
      localStorage.removeItem('buylink_user');
      logout();
      queryClient.clear();

      handleApiError(error, 'Error signing out, but you have been logged out locally');
      navigate('/');
    },
  });
};

// Combined hook for the complete auth flow
export const useAuthFlow = () => {
  const validateHandle = useValidateHandle();
  const signup = useSignup();
  const verifySignup = useVerifySignup();
  const signout = useSignout();
  const { checkAndPromptSubscription } = useCheckSubscription();

  return {
    validateHandle,
    signup,
    verifySignup,
    signout,
    checkAndPromptSubscription,

    // Helper to check if any operation is loading
    isLoading: validateHandle.isPending || signup.isPending || verifySignup.isPending || signout.isPending,

    // Helper to reset all mutations
    reset: () => {
      validateHandle.reset();
      signup.reset();
      verifySignup.reset();
      signout.reset();
    }
  };
};
