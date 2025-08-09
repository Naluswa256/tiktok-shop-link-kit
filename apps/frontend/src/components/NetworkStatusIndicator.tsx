import { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/utils';

interface NetworkStatusIndicatorProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const NetworkStatusIndicator = ({ 
  className, 
  showText = false, 
  size = 'md' 
}: NetworkStatusIndicatorProps) => {
  const { isOnline, connectionQuality, connectionMessage, isSlowConnection } = useNetworkStatus();
  const [showIndicator, setShowIndicator] = useState(false);

  // Only show indicator when offline or slow connection
  useEffect(() => {
    setShowIndicator(!isOnline || isSlowConnection);
  }, [isOnline, isSlowConnection]);

  if (!showIndicator) return null;

  const getIcon = () => {
    if (!isOnline) return WifiOff;
    if (isSlowConnection) return AlertTriangle;
    return Wifi;
  };

  const getColor = () => {
    if (!isOnline) return 'text-destructive';
    if (connectionQuality === 'poor' || connectionQuality === 'fair') return 'text-warning';
    return 'text-success';
  };

  const getSize = () => {
    switch (size) {
      case 'sm': return 'w-3 h-3';
      case 'lg': return 'w-6 h-6';
      default: return 'w-4 h-4';
    }
  };

  const Icon = getIcon();

  return (
    <div className={cn(
      'flex items-center gap-2',
      className
    )}>
      <Icon className={cn(getSize(), getColor())} />
      {showText && (
        <span className={cn(
          'text-sm font-medium',
          getColor()
        )}>
          {connectionMessage}
        </span>
      )}
    </div>
  );
};

// Floating network status banner for critical offline states
export const NetworkStatusBanner = () => {
  const { isOnline } = useNetworkStatus();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Show banner only when completely offline
    setShowBanner(!isOnline);
  }, [isOnline]);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2">
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <WifiOff className="w-4 h-4" />
        <span>No internet connection - Some features may not work</span>
        <button
          onClick={() => window.location.reload()}
          className="ml-4 px-2 py-1 bg-destructive-foreground text-destructive rounded text-xs hover:bg-opacity-90 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
};

// Connection quality badge for debugging/admin purposes
export const ConnectionQualityBadge = ({ className }: { className?: string }) => {
  const { connectionQuality, effectiveType, downlink, rtt } = useNetworkStatus();

  const getQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
      case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'fair': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'poor': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'offline': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-2 py-1 rounded-md border text-xs font-medium',
      getQualityColor(),
      className
    )}>
      <div className="flex items-center gap-1">
        <div className={cn(
          'w-2 h-2 rounded-full',
          connectionQuality === 'excellent' ? 'bg-green-500' :
          connectionQuality === 'good' ? 'bg-blue-500' :
          connectionQuality === 'fair' ? 'bg-yellow-500' :
          connectionQuality === 'poor' ? 'bg-orange-500' :
          'bg-red-500'
        )} />
        <span className="capitalize">{connectionQuality}</span>
      </div>
      
      {effectiveType && (
        <span className="text-xs opacity-75">
          {effectiveType.toUpperCase()}
        </span>
      )}
      
      {downlink && (
        <span className="text-xs opacity-75">
          {downlink.toFixed(1)}Mbps
        </span>
      )}
      
      {rtt && (
        <span className="text-xs opacity-75">
          {rtt}ms
        </span>
      )}
    </div>
  );
};

// Hook for components that need to react to network changes
export const useNetworkAwareActions = () => {
  const { isOnline, testConnectivity } = useNetworkStatus();

  const executeWithNetworkCheck = async function <T>(
    action: () => Promise<T>,
    options?: {
      showOfflineMessage?: boolean;
    }
  ): Promise<T> {
    const { showOfflineMessage = true } = options || {};

    if (!isOnline) {
      if (showOfflineMessage) {
        throw new Error('No internet connection. Please check your network and try again.');
      }
      throw new Error('Network unavailable');
    }

    // Test actual connectivity
    const hasConnectivity = await testConnectivity();
    if (!hasConnectivity) {
      throw new Error('Unable to reach server. Please check your internet connection.');
    }

    return action();
  };

  return {
    isOnline,
    executeWithNetworkCheck,
    testConnectivity,
  };
};
