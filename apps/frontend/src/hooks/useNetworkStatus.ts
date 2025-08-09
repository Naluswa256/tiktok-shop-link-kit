import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

interface NetworkConnection extends Navigator {
  connection?: {
    effectiveType: string;
    type: string;
    downlink: number;
    rtt: number;
    addEventListener: (event: string, handler: () => void) => void;
    removeEventListener: (event: string, handler: () => void) => void;
  };
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    connectionType: null,
    effectiveType: null,
    downlink: null,
    rtt: null,
  });

  const [wasOffline, setWasOffline] = useState(false);

  const updateNetworkStatus = () => {
    const navigator = window.navigator as NetworkConnection;
    const connection = navigator.connection;

    const isOnline = navigator.onLine;
    const isSlowConnection = connection ? 
      (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.downlink < 0.5) : 
      false;

    setNetworkStatus({
      isOnline,
      isSlowConnection,
      connectionType: connection?.type || null,
      effectiveType: connection?.effectiveType || null,
      downlink: connection?.downlink || null,
      rtt: connection?.rtt || null,
    });

    // Show notifications for connection changes
    if (!isOnline && !wasOffline) {
      toast.error('No internet connection. Please check your network and try again.', {
        id: 'offline-toast',
        duration: Infinity,
        action: {
          label: 'Retry',
          onClick: () => window.location.reload(),
        },
      });
      setWasOffline(true);
    } else if (isOnline && wasOffline) {
      toast.dismiss('offline-toast');
      toast.success('Internet connection restored!', {
        duration: 3000,
      });
      setWasOffline(false);
    } else if (isOnline && isSlowConnection) {
      toast.warning('Slow internet connection detected. Some features may be slower.', {
        id: 'slow-connection-toast',
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    // Initial check
    updateNetworkStatus();

    // Listen for online/offline events
    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes (if supported)
    const navigator = window.navigator as NetworkConnection;
    const connection = navigator.connection;
    
    if (connection) {
      const handleConnectionChange = () => updateNetworkStatus();
      connection.addEventListener('change', handleConnectionChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // Test internet connectivity by making a small request
  const testConnectivity = async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false;
    }

    try {
      // Use a small, fast endpoint to test connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      // If our API is down, try a public endpoint
      try {
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000),
        });
        return true; // If we can reach Google, internet is working
      } catch (fallbackError) {
        return false;
      }
    }
  };

  const getConnectionQuality = (): 'excellent' | 'good' | 'fair' | 'poor' | 'offline' => {
    if (!networkStatus.isOnline) return 'offline';
    
    if (networkStatus.effectiveType) {
      switch (networkStatus.effectiveType) {
        case '4g':
          return 'excellent';
        case '3g':
          return 'good';
        case '2g':
          return 'fair';
        case 'slow-2g':
          return 'poor';
        default:
          return 'good';
      }
    }

    // Fallback based on downlink speed
    if (networkStatus.downlink !== null) {
      if (networkStatus.downlink >= 10) return 'excellent';
      if (networkStatus.downlink >= 1.5) return 'good';
      if (networkStatus.downlink >= 0.5) return 'fair';
      return 'poor';
    }

    return 'good'; // Default assumption
  };

  const getConnectionMessage = (): string => {
    const quality = getConnectionQuality();
    
    switch (quality) {
      case 'offline':
        return 'No internet connection';
      case 'poor':
        return 'Very slow connection';
      case 'fair':
        return 'Slow connection';
      case 'good':
        return 'Good connection';
      case 'excellent':
        return 'Excellent connection';
      default:
        return 'Connected';
    }
  };

  return {
    ...networkStatus,
    connectionQuality: getConnectionQuality(),
    connectionMessage: getConnectionMessage(),
    testConnectivity,
  };
};
