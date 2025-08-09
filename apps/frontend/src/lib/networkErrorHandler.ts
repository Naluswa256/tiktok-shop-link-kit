import { toast } from 'sonner';

export interface NetworkError extends Error {
  isNetworkError: boolean;
  isTimeoutError: boolean;
  isServerError: boolean;
  statusCode?: number;
  originalError?: any;
}

export const createNetworkError = (
  message: string,
  options: {
    isNetworkError?: boolean;
    isTimeoutError?: boolean;
    isServerError?: boolean;
    statusCode?: number;
    originalError?: any;
  } = {}
): NetworkError => {
  const error = new Error(message) as NetworkError;
  error.isNetworkError = options.isNetworkError ?? false;
  error.isTimeoutError = options.isTimeoutError ?? false;
  error.isServerError = options.isServerError ?? false;
  error.statusCode = options.statusCode;
  error.originalError = options.originalError;
  return error;
};

export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  
  // Check if it's our custom NetworkError
  if (error.isNetworkError) return true;
  
  // Check for common network error indicators
  const networkErrorMessages = [
    'network error',
    'failed to fetch',
    'networkerror',
    'network request failed',
    'connection refused',
    'connection reset',
    'connection timeout',
    'dns lookup failed',
    'no internet connection',
    'offline',
  ];
  
  const errorMessage = (error.message || '').toLowerCase();
  const errorName = (error.name || '').toLowerCase();
  
  return networkErrorMessages.some(msg => 
    errorMessage.includes(msg) || errorName.includes(msg)
  );
};

export const isTimeoutError = (error: any): boolean => {
  if (!error) return false;
  
  // Check if it's our custom timeout error
  if (error.isTimeoutError) return true;
  
  // Check for timeout indicators
  const timeoutMessages = [
    'timeout',
    'timed out',
    'request timeout',
    'response timeout',
    'aborted',
  ];
  
  const errorMessage = (error.message || '').toLowerCase();
  const errorName = (error.name || '').toLowerCase();
  
  return timeoutMessages.some(msg => 
    errorMessage.includes(msg) || errorName.includes(msg)
  ) || error.name === 'AbortError';
};

export const isServerError = (error: any): boolean => {
  if (!error) return false;
  
  // Check if it's our custom server error
  if (error.isServerError) return true;
  
  // Check for 5xx status codes
  if (error.statusCode && error.statusCode >= 500) return true;
  if (error.status && error.status >= 500) return true;
  
  return false;
};

export const getErrorMessage = (error: any): string => {
  if (!navigator.onLine) {
    return 'No internet connection. Please check your network and try again.';
  }
  
  if (isTimeoutError(error)) {
    return 'Request timed out. Please check your internet connection and try again.';
  }
  
  if (isNetworkError(error)) {
    return 'Network error. Please check your internet connection and try again.';
  }
  
  if (isServerError(error)) {
    return 'Server error. Please try again in a few moments.';
  }
  
  // Check for specific status codes
  if (error.statusCode || error.status) {
    const statusCode = error.statusCode || error.status;
    switch (statusCode) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Authentication required. Please sign in and try again.';
      case 403:
        return 'Access denied. You don\'t have permission to perform this action.';
      case 404:
        return 'Resource not found. The requested item may have been removed.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Internal server error. Please try again later.';
      case 502:
        return 'Service temporarily unavailable. Please try again later.';
      case 503:
        return 'Service unavailable. Please try again later.';
      default:
        if (statusCode >= 400 && statusCode < 500) {
          return 'Client error. Please check your request and try again.';
        }
        if (statusCode >= 500) {
          return 'Server error. Please try again later.';
        }
    }
  }
  
  // Fallback to original error message or generic message
  return error.message || 'An unexpected error occurred. Please try again.';
};

export const showNetworkErrorToast = (error: any, customMessage?: string): void => {
  const message = customMessage || getErrorMessage(error);
  
  if (!navigator.onLine || isNetworkError(error)) {
    toast.error(message, {
      id: 'network-error-toast',
      duration: Infinity,
      action: {
        label: 'Retry',
        onClick: () => window.location.reload(),
      },
    });
  } else if (isTimeoutError(error)) {
    toast.error(message, {
      duration: 8000,
      action: {
        label: 'Retry',
        onClick: () => window.location.reload(),
      },
    });
  } else if (isServerError(error)) {
    toast.error(message, {
      duration: 6000,
    });
  } else {
    toast.error(message, {
      duration: 5000,
    });
  }
};

export const handleApiError = (error: any, context?: string): NetworkError => {
  console.error(`API Error${context ? ` (${context})` : ''}:`, error);
  
  let networkError: NetworkError;
  
  if (!navigator.onLine) {
    networkError = createNetworkError(
      'No internet connection. Please check your network and try again.',
      { isNetworkError: true, originalError: error }
    );
  } else if (isTimeoutError(error)) {
    networkError = createNetworkError(
      'Request timed out. Please check your internet connection and try again.',
      { isTimeoutError: true, originalError: error }
    );
  } else if (isNetworkError(error)) {
    networkError = createNetworkError(
      'Network error. Please check your internet connection and try again.',
      { isNetworkError: true, originalError: error }
    );
  } else if (isServerError(error)) {
    networkError = createNetworkError(
      getErrorMessage(error),
      { isServerError: true, statusCode: error.statusCode || error.status, originalError: error }
    );
  } else {
    networkError = createNetworkError(
      getErrorMessage(error),
      { statusCode: error.statusCode || error.status, originalError: error }
    );
  }
  
  // Show toast notification
  showNetworkErrorToast(networkError);
  
  return networkError;
};

// Retry utility for failed requests
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if offline or if it's the last attempt
      if (!navigator.onLine || attempt === maxRetries) {
        throw error;
      }
      
      // Don't retry client errors (4xx) except for 408 (timeout) and 429 (rate limit)
      const statusCode = error.statusCode || error.status;
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 429) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};
