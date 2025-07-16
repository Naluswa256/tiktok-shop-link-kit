import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/tiktok-commerce';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Star, Zap, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionPromptProps {
  isOpen: boolean;
  onClose: () => void;
  handle: string;
  onSubscribe: () => void;
}

export const SubscriptionPrompt = ({ isOpen, onClose, handle, onSubscribe }: SubscriptionPromptProps) => {
  const navigate = useNavigate();
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    
    try {
      // Simulate API call to start trial
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mark trial as started
      localStorage.setItem('buylink_trial_started', 'true');
      localStorage.setItem('buylink_trial_start_date', new Date().toISOString());
      
      toast.success('Free trial activated! Welcome to BuyLink UG 🎉');
      
      onSubscribe();
      onClose();
      
      // Navigate to shop page
      navigate(`/shop/${handle}`);
    } catch (error) {
      toast.error('Failed to start trial. Please try again.');
    } finally {
      setIsStartingTrial(false);
    }
  };

  const features = [
    {
      icon: <Zap className="w-5 h-5 text-accent" />,
      title: 'Auto Product Generation',
      description: 'AI creates product cards from your TikTok videos'
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-accent" />,
      title: 'Analytics Dashboard',
      description: 'Track views, clicks, and sales performance'
    },
    {
      icon: <Star className="w-5 h-5 text-accent" />,
      title: 'Custom Shop Link',
      description: 'Professional buylink.ug/shop/yourhandle URL'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            Welcome to BuyLink UG! 🎉
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-lg">
          {/* Shop Preview */}
          <div className="text-center space-y-sm">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <span className="text-lg font-bold text-primary">
                {handle.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="text-lg font-semibold">@{handle}'s Shop</h3>
            <p className="text-sm text-muted-foreground">
              buylink.ug/shop/{handle}
            </p>
          </div>

          {/* Features */}
          <div className="space-y-md">
            <h4 className="text-sm font-semibold text-center">What you get:</h4>
            <div className="space-y-sm">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {feature.icon}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trial Info */}
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="p-md text-center space-y-sm">
              <div className="flex items-center justify-center gap-2">
                <Star className="w-5 h-5 text-accent" />
                <span className="text-sm font-semibold">7-Day Free Trial</span>
              </div>
              <p className="text-xs text-muted-foreground">
                No credit card required. Cancel anytime.
              </p>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Check className="w-3 h-3 text-success" />
                <span>Then UGX 15,000/month</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-sm">
            <Button 
              variant="primary" 
              size="block"
              onClick={handleStartTrial}
              disabled={isStartingTrial}
              className="gap-2"
            >
              {isStartingTrial ? 'Starting Trial...' : 'Start Free Trial'}
            </Button>
            
            <Button 
              variant="ghost" 
              size="block"
              onClick={onClose}
              disabled={isStartingTrial}
            >
              Maybe Later
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our Terms of Service
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
