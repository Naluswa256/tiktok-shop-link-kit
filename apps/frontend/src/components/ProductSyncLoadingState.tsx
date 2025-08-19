import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Clock, Video, TrendingUp, Sparkles } from 'lucide-react';

interface ProductSyncLoadingStateProps {
  stage: 'queued' | 'processing' | 'finalizing';
  position?: number;
  countdown?: string;
  className?: string;
}

export const ProductSyncLoadingState: React.FC<ProductSyncLoadingStateProps> = ({
  stage,
  position,
  countdown,
  className = '',
}) => {
  const getStageInfo = () => {
    switch (stage) {
      case 'queued':
        return {
          icon: Clock,
          title: 'Sync Queued',
          description: 'Your request is in the queue and will be processed soon',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
        };
      case 'processing':
        return {
          icon: Video,
          title: 'Processing Videos',
          description: 'Analyzing your TikTok videos and extracting product information',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 dark:bg-amber-950/20',
          borderColor: 'border-amber-200 dark:border-amber-800',
        };
      case 'finalizing':
        return {
          icon: Sparkles,
          title: 'Almost Done',
          description: 'Finalizing your products and updating your shop',
          color: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-200 dark:border-green-800',
        };
    }
  };

  const stageInfo = getStageInfo();
  const Icon = stageInfo.icon;

  return (
    <Card className={`${stageInfo.borderColor} ${stageInfo.bgColor} ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-full ${stageInfo.bgColor} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${stageInfo.color} ${stage === 'processing' ? 'animate-pulse' : ''}`} />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-lg font-semibold ${stageInfo.color}`}>
                {stageInfo.title}
              </h3>
              {position && stage === 'queued' && (
                <Badge variant="secondary" className="text-xs">
                  #{position} in queue
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {stageInfo.description}
            </p>
            
            {countdown && stage === 'queued' && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Estimated time: {countdown}
                </span>
              </div>
            )}
            
            {stage === 'processing' && (
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                <span className="text-muted-foreground">
                  This usually takes 10-15 seconds
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${stageInfo.color}`} />
              <span className={`text-xs font-medium ${stageInfo.color}`}>
                Syncing
              </span>
            </div>
          </div>
        </div>
        
        {/* Progress indicator */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Progress</span>
            <span>
              {stage === 'queued' ? '0%' : stage === 'processing' ? '50%' : '90%'}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ${
                stage === 'queued' 
                  ? 'w-0 bg-blue-500' 
                  : stage === 'processing' 
                  ? 'w-1/2 bg-amber-500' 
                  : 'w-11/12 bg-green-500'
              }`}
            />
          </div>
        </div>
        
        {/* Tips */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Make sure your TikTok videos include the #TRACK hashtag 
            to be automatically detected and added as products.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductSyncLoadingState;
