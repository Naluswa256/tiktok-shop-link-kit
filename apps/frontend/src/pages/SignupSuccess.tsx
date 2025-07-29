import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ExternalLink, ArrowRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const SignupSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  const handle = searchParams.get('handle');
  const shopLink = searchParams.get('shopLink');

  useEffect(() => {
    // If no handle or shop link, redirect to home
    if (!handle || !shopLink) {
      navigate('/');
    }
  }, [handle, shopLink, navigate]);

  const fullShopUrl = `${window.location.origin}${shopLink}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullShopUrl);
      setCopied(true);
      toast.success('Shop link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleVisitShop = () => {
    window.open(fullShopUrl, '_blank');
  };

  const handleContinueSetup = () => {
    // Navigate to the shop page for owner setup
    navigate(shopLink || '/');
  };

  if (!handle || !shopLink) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>

              {/* Success Message */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Account Created Successfully!
                </h1>
                <p className="text-muted-foreground">
                  Your TikTok shop is now live and ready for customers
                </p>
              </div>

              {/* Handle Display */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  TikTok Handle
                </p>
                <p className="text-lg font-semibold text-primary">
                  {handle}
                </p>
              </div>

              {/* Shop Link */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Your Shop Link
                </p>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-mono text-foreground flex-1 truncate">
                    {fullShopUrl}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleVisitShop}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview Your Shop
                </Button>
                
                <Button
                  onClick={handleContinueSetup}
                  className="w-full gap-2"
                >
                  Continue Setup
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Next Steps */}
              <div className="text-left space-y-3 pt-4 border-t">
                <h3 className="font-semibold text-sm text-foreground">
                  What's Next?
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
                    <span>Choose your subscription plan (7-day free trial available)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
                    <span>Share your shop link on your TikTok bio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
                    <span>Start receiving orders from your followers</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            Need help? Contact our support team
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupSuccess;
