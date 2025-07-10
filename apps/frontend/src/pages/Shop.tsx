
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout, Header, Button, PageViewCounter } from '@/components/tiktok-commerce';
import { MessageCircle, Share2, TrendingUp, Video, LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const Shop = () => {
  const navigate = useNavigate();
  const { handle } = useParams<{ handle: string }>();
  
  const shopHandle = handle || 'unknown';
  const hasProducts = false; // Simulate no products yet

  return (
    <Layout
      header={
        <Header 
          title={`@${shopHandle}`}
          actions={
            <div className="flex items-center gap-sm">
              <PageViewCounter count={0} />
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/login')}
                className="gap-2"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
              <Button variant="ghost" size="sm">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          }
        />
      }
    >
      <div className="space-y-lg">
        {/* Shop Header */}
        <div className="text-center space-y-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-lg font-bold text-primary">
              {shopHandle.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            @{shopHandle}'s Shop
          </h1>
          <p className="text-sm text-muted-foreground">
            buylink.ug/shop/{shopHandle}
          </p>
        </div>

        {/* Empty State */}
        {!hasProducts && (
          <Card className="mx-auto max-w-md">
            <CardContent className="p-lg text-center space-y-md">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
                <Video className="w-8 h-8 text-muted-foreground" />
              </div>
              
              <div className="space-y-sm">
                <h2 className="text-base font-semibold text-foreground">
                  No products yet
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Post a TikTok video with <span className="font-semibold text-primary">#TRACK</span> to generate your first listing!
                </p>
              </div>

              <div className="bg-accent/10 rounded-ds-md p-md space-y-sm">
                <div className="flex items-center justify-center gap-2 text-accent">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">How it works:</span>
                </div>
                <ol className="text-xs text-muted-foreground space-y-1">
                  <li>1. Post your product on TikTok</li>
                  <li>2. Add #TRACK in your caption</li>
                  <li>3. We'll auto-generate your product card</li>
                  <li>4. Share your shop link anywhere!</li>
                </ol>
              </div>

              <Button variant="primary" size="block">
                Learn How It Works
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contact Section */}
        <Card>
          <CardContent className="p-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Ready to buy?
                </p>
                <p className="text-xs text-muted-foreground">
                  Chat directly with the seller
                </p>
              </div>
              <Button variant="accent" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Shop;
