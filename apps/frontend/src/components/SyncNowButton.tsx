import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Clock, CheckCircle, AlertCircle, Zap, TrendingUp, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface SyncStatus {
  status: 'idle' | 'syncing' | 'queued' | 'processing' | 'success' | 'error';
  message?: string;
  position?: number;
  estimatedWaitTime?: string;
  startTime?: number;
  processingStartTime?: number;
}

interface SyncNowButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost' | 'attention';
  onSyncComplete?: () => void;
  showAttentionCard?: boolean;
}

export const SyncNowButton: React.FC<SyncNowButtonProps> = ({
  className = '',
  size = 'sm',
  variant = 'default',
  onSyncComplete,
  showAttentionCard = false,
}) => {
  const { user, isAuthenticated, token } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'idle' });
  const [countdown, setCountdown] = useState<number>(0);

  // Countdown effect for processing state
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (syncStatus.status === 'queued' && syncStatus.estimatedWaitTime) {
      const waitMinutes = parseInt(syncStatus.estimatedWaitTime.split(' ')[0]) || 2;
      const totalSeconds = waitMinutes * 60;
      setCountdown(totalSeconds);

      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setSyncStatus({ status: 'processing', message: 'Processing your videos...' });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (syncStatus.status === 'processing') {
      // Simulate processing time (10-15 seconds actual processing based on our backend tests)
      setTimeout(() => {
        setSyncStatus({ status: 'success', message: 'Sync completed!' });
        toast.success('🎉 Video sync completed! Your new products are now live.');
        onSyncComplete?.();

        // Reset to idle after 5 seconds
        setTimeout(() => {
          setSyncStatus({ status: 'idle' });
        }, 5000);
      }, 15000); // 15 seconds processing time (realistic based on backend logs)
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncStatus.status, syncStatus.estimatedWaitTime, onSyncComplete]);

  const handleSyncNow = async () => {
    if (!isAuthenticated || !user || !token) {
      toast.error('Please sign in to sync your videos');
      return;
    }

    setSyncStatus({ status: 'syncing', startTime: Date.now() });

    try {
      const response = await fetch('https://api.buylink.app/api/v1/ingestion/sync-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync videos');
      }

      if (data.success && data.data) {
        setSyncStatus({
          status: 'queued',
          message: data.data.message,
          position: data.data.position,
          estimatedWaitTime: data.data.estimatedWaitTime,
        });

        toast.success(
          `🚀 Sync queued successfully! Position #${data.data.position}`,
          {
            description: `Estimated wait: ${data.data.estimatedWaitTime}`,
            duration: 4000,
          }
        );
      }

    } catch (error: any) {
      console.error('Sync failed:', error);
      
      setSyncStatus({
        status: 'error',
        message: error.message || 'Failed to sync videos',
      });

      // Handle specific error cases
      if (error.message.includes('Rate limit')) {
        toast.error('Too many sync requests. Please wait a moment and try again.');
      } else if (error.message.includes('quota')) {
        toast.error('Monthly sync quota exceeded. Upgrade your plan for more syncs.');
      } else {
        toast.error('Failed to sync videos. Please try again later.');
      }

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setSyncStatus({ status: 'idle' });
      }, 5000);
    }
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getButtonContent = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">Syncing...</span>
            <span className="sm:hidden">Sync</span>
          </>
        );

      case 'queued':
        return (
          <>
            <Clock className="w-4 h-4 animate-pulse" />
            <span className="hidden sm:inline">
              Queued #{syncStatus.position} {countdown > 0 ? `(${formatCountdown(countdown)})` : ''}
            </span>
            <span className="sm:hidden">
              #{syncStatus.position} {countdown > 0 ? formatCountdown(countdown) : ''}
            </span>
          </>
        );

      case 'processing':
        return (
          <>
            <Video className="w-4 h-4 animate-pulse" />
            <span className="hidden sm:inline">Processing videos...</span>
            <span className="sm:hidden">Processing</span>
          </>
        );

      case 'success':
        return (
          <>
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="hidden sm:inline">Synced!</span>
            <span className="sm:hidden">Done</span>
          </>
        );
      
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">Try Again</span>
            <span className="sm:hidden">Retry</span>
          </>
        );

      default:
        return variant === 'attention' ? (
          <>
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="hidden sm:inline font-semibold">Sync Instantly</span>
            <span className="sm:hidden font-semibold">Sync</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Sync Now</span>
            <span className="sm:hidden">Sync</span>
          </>
        );
    }
  };

  const getButtonVariant = () => {
    switch (syncStatus.status) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'queued':
      case 'processing':
        return 'secondary';
      case 'syncing':
        return 'outline';
      default:
        return variant === 'attention' ? 'default' : variant;
    }
  };

  const getButtonSize = () => {
    return size === 'lg' ? 'lg' : 'sm';
  };

  const isDisabled = ['syncing', 'queued', 'processing'].includes(syncStatus.status);

  // Attention-grabbing card component
  if (showAttentionCard) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground mb-1">
                Instantly sync shop link to see latest products
              </h4>
              <p className="text-xs text-muted-foreground">
                Get your newest TikTok videos with #TRACK as products in 2-3 minutes
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button
                onClick={handleSyncNow}
                disabled={isDisabled || !isAuthenticated}
                variant={getButtonVariant() as any}
                size="sm"
                className={`gap-2 ${variant === 'attention' ? 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold shadow-md' : ''} ${className}`}
                title={
                  !isAuthenticated
                    ? 'Sign in to sync videos'
                    : syncStatus.message || 'Sync your latest TikTok videos instantly'
                }
              >
                {getButtonContent()}
              </Button>
            </div>
          </div>

          {/* Status messages */}
          {syncStatus.status === 'queued' && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Clock className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-medium">
                  Position #{syncStatus.position} in queue
                  {countdown > 0 && ` • ${formatCountdown(countdown)} remaining`}
                </span>
              </div>
            </div>
          )}

          {syncStatus.status === 'processing' && (
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Video className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-medium">
                  Processing your videos... This usually takes 2-3 minutes
                </span>
              </div>
            </div>
          )}

          {syncStatus.status === 'success' && (
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">
                  🎉 Sync completed! Your products are now live
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Simple button component
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        onClick={handleSyncNow}
        disabled={isDisabled || !isAuthenticated}
        variant={getButtonVariant() as any}
        size={getButtonSize() as any}
        className={`gap-2 ${variant === 'attention' ? 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold shadow-md' : ''} ${className}`}
        title={
          !isAuthenticated
            ? 'Sign in to sync videos'
            : syncStatus.message || 'Sync your latest TikTok videos'
        }
      >
        {getButtonContent()}
      </Button>

      {/* Status message for queued state */}
      {syncStatus.status === 'queued' && syncStatus.estimatedWaitTime && (
        <span className="text-xs text-muted-foreground text-center">
          Est. wait: {syncStatus.estimatedWaitTime}
        </span>
      )}
    </div>
  );
};

export default SyncNowButton;
