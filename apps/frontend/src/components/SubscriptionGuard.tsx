import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSubscriptionGuard, useTrialExpiryMonitor } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  fallbackPath?: string;
}

// Loading component for subscription checks
const SubscriptionLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
      <p className="text-sm text-muted-foreground">Checking subscription status...</p>
    </div>
  </div>
);

// Error component for subscription check failures
const SubscriptionError = ({ error }: { error: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4 max-w-md mx-auto p-6">
      <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
        <span className="text-destructive text-xl">⚠️</span>
      </div>
      <h2 className="text-lg font-semibold text-foreground">Subscription Check Failed</h2>
      <p className="text-sm text-muted-foreground">{error}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
);

// Main subscription guard component
export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({
  children,
  requireAuth = true,
  fallbackPath = '/subscription',
}) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const { checkSubscription } = useSubscriptionGuard();
  const { isExpired, handleExpiry } = useTrialExpiryMonitor();

  // Check for trial expiry in real-time
  useEffect(() => {
    if (isExpired) {
      handleExpiry();
    }
  }, [isExpired, handleExpiry]);

  // If auth is required but user is not authenticated
  if (requireAuth && !authLoading && !isAuthenticated) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }

  // If still loading auth
  if (requireAuth && authLoading) {
    return <SubscriptionLoading />;
  }

  // If authenticated, check subscription
  if (isAuthenticated) {
    const subscriptionCheck = checkSubscription(location.pathname);

    if (subscriptionCheck.loading) {
      return <SubscriptionLoading />;
    }

    if (subscriptionCheck.error) {
      return <SubscriptionError error={subscriptionCheck.error} />;
    }

    if (!subscriptionCheck.allowed) {
      return (
        <Navigate 
          to={fallbackPath} 
          state={{ 
            returnTo: location.pathname,
            reason: subscriptionCheck.expired ? 'subscription_expired' : 'subscription_required'
          }} 
          replace 
        />
      );
    }
  }

  return <>{children}</>;
};

// HOC for wrapping components with subscription guard
export const withSubscriptionGuard = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requireAuth?: boolean;
    fallbackPath?: string;
  }
) => {
  const WrappedComponent = (props: P) => (
    <SubscriptionGuard 
      requireAuth={options?.requireAuth}
      fallbackPath={options?.fallbackPath}
    >
      <Component {...props} />
    </SubscriptionGuard>
  );

  WrappedComponent.displayName = `withSubscriptionGuard(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Protected route component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireSubscription?: boolean;
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireSubscription = true,
  fallbackPath = '/subscription',
}) => {
  if (!requireSubscription) {
    // If subscription is not required, just check auth
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (requireAuth && isLoading) {
      return <SubscriptionLoading />;
    }

    if (requireAuth && !isAuthenticated) {
      return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
    }

    return <>{children}</>;
  }

  // If subscription is required, use full subscription guard
  return (
    <SubscriptionGuard requireAuth={requireAuth} fallbackPath={fallbackPath}>
      {children}
    </SubscriptionGuard>
  );
};

// Trial expiry modal component
interface TrialExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  timeLeft?: string | null;
}

export const TrialExpiryModal: React.FC<TrialExpiryModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
  timeLeft,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg max-w-md w-full p-6 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-warning text-xl">⏰</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {timeLeft ? 'Trial Ending Soon' : 'Trial Expired'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {timeLeft 
              ? `Your free trial expires in ${timeLeft}. Subscribe now to continue accessing your shop.`
              : 'Your free trial has expired. Please subscribe to continue accessing your shop.'
            }
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors"
          >
            {timeLeft ? 'Remind Later' : 'Close'}
          </button>
          <button
            onClick={onSubscribe}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
          >
            Subscribe Now
          </button>
        </div>
      </div>
    </div>
  );
};
