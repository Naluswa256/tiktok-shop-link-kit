
import React, { useState } from 'react';
import { Layout, Header, Button } from '@/components/tiktok-commerce';
import { Check, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const Subscription = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = () => {
    setIsSubscribed(true);
  };

  return (
    <Layout
      header={
        <Header 
          title="Subscription" 
          actions={
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          }
        />
      }
    >
      <div className="max-w-md mx-auto space-y-lg">
        <div className="text-center space-y-sm">
          <h1 className="text-xl font-bold text-foreground">
            Start Your Shop
          </h1>
          <p className="text-sm text-muted-foreground">
            Get your TikTok shop link and start selling today
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-lg space-y-lg">
            {!isSubscribed ? (
              <>
                <div className="text-center space-y-md">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-2xl font-bold text-primary">₵</span>
                  </div>
                  
                  <div className="space-y-sm">
                    <div className="text-3xl font-bold text-foreground">
                      UGX 5,000
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Everything you need to sell on TikTok
                    </p>
                  </div>
                </div>

                <div className="space-y-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>Auto-generate products from TikTok videos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>WhatsApp integration for easy selling</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>Live page view analytics</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>Shareable shop link</span>
                  </div>
                </div>

                <Button 
                  variant="primary" 
                  size="block"
                  onClick={handleSubscribe}
                  className="w-full"
                >
                  Subscribe Now
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Cancel anytime • No setup fees • 7-day free trial
                </p>
              </>
            ) : (
              <div className="text-center space-y-md">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-success" />
                </div>
                
                <div className="space-y-sm">
                  <h2 className="text-lg font-semibold text-success">
                    Welcome to TikTok Commerce!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Your subscription is active. Start posting TikTok videos with #TRACK to generate your first products.
                  </p>
                </div>

                <div className="bg-muted/50 rounded-ds-md p-md">
                  <p className="text-xs text-muted-foreground">
                    Next: Share your shop link and start selling!
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Subscription;
