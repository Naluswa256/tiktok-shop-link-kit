
import React, { useState } from 'react';
import { Layout, Header, Button } from '@/components/tiktok-commerce';
import { SignupFlow } from '@/components/SignupFlow';
import { FeatureCard } from '@/components/FeatureCard';
import { ProductCatalogPreview } from '@/components/ProductCatalogPreview';
import { HowItWorks } from '@/components/HowItWorks';
import { ScrollText, MessageCircle, Eye, ArrowRight, Sparkles, Play } from 'lucide-react';

const Index = () => {
  const [showSignup, setShowSignup] = useState(false);

  const scrollToSignup = () => {
    setShowSignup(true);
    setTimeout(() => {
      document.getElementById('signup-section')?.scrollIntoView({ 
        behavior: 'smooth' 
      });
    }, 100);
  };

  return (
    <Layout
      header={
        <Header 
          title="BuyLink UG" 
          actions={
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          }
        />
      }
    >
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 pt-xl pb-lg">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="grid grid-cols-3 gap-2 h-full transform rotate-12 scale-110">
            {Array.from({ length: 12 }).map((_, i) => (
              <div 
                key={i}
                className="bg-primary rounded-ds-sm animate-pulse"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '3s'
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 text-center space-y-lg max-w-2xl mx-auto">
          <div className="space-y-md">
            <div className="flex items-center justify-center gap-2 text-accent font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>New for Uganda</span>
              <Sparkles className="w-4 h-4" />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              Turn Your TikTok Videos<br />
              <span className="text-primary">into a Shop Link</span>
            </h1>
            
            <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
              <span className="font-semibold">Every product you post. Instantly shoppable.</span><br />
              Sell what you post. Let buyers message you directly on WhatsApp.
            </p>
            
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No websites. No coding. Just post with <span className="font-semibold text-primary">#TRACK</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-sm justify-center items-center">
            <Button 
              variant="primary" 
              size="lg"
              onClick={scrollToSignup}
              className="group"
            >
              Get My Shop Link
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
            
            <Button variant="ghost" size="lg" className="gap-2">
              <Play className="w-4 h-4" />
              See Example
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="pt-lg">
            <p className="text-xs text-muted-foreground mb-sm">Trusted by 500+ Ugandan sellers</p>
            <div className="flex justify-center items-center gap-4 opacity-60">
              <div className="flex -space-x-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div 
                    key={i}
                    className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-semibold"
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span className="text-xs">+495 more</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-xl bg-muted/30">
        <HowItWorks />
      </section>

      {/* Feature Highlights */}
      <section className="py-xl space-y-lg">
        <div className="text-center space-y-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Sell Smarter, Not Harder
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything you need to turn your TikTok into a business
          </p>
        </div>

        <div className="grid gap-md sm:grid-cols-3">
          <FeatureCard
            icon={<ScrollText className="w-6 h-6" />}
            title="Auto-Generate Products"
            description="Just post with #TRACK, we do the rest."
            highlight="No manual uploads"
          />
          
          <FeatureCard
            icon={<MessageCircle className="w-6 h-6" />}
            title="Buy on WhatsApp"
            description="One-tap to chat and sell directly."
            highlight="Instant connection"
          />
          
          <FeatureCard
            icon={<Eye className="w-6 h-6" />}
            title="Live Page Views"
            description="Know how many buyers visited."
            highlight="Real-time stats"
          />
        </div>
      </section>

      {/* Product Catalog Preview */}
      <section className="py-xl bg-muted/30">
        <div className="text-center space-y-lg">
          <div className="space-y-sm">
            <h2 className="text-xl font-semibold text-foreground">
              Your Shop Preview
            </h2>
            <p className="text-sm text-muted-foreground">
              Interactive product tiles from your TikTok videos
            </p>
          </div>
          
          <ProductCatalogPreview />
          
          <p className="text-xs text-muted-foreground">
            Hover over products to see interactions
          </p>
        </div>
      </section>

      {/* Signup Section */}
      <section id="signup-section" className="py-xl">
        <div className="space-y-lg">
          <div className="text-center space-y-sm">
            <h2 className="text-xl font-semibold text-foreground">
              Ready to Get Started?
            </h2>
            <p className="text-sm text-muted-foreground">
              Create your shop link in under 2 minutes
            </p>
          </div>
          
          {showSignup && <SignupFlow />}
          
          {!showSignup && (
            <div className="text-center">
              <Button 
                variant="primary" 
                size="lg"
                onClick={scrollToSignup}
              >
                Start Now - It's Free
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-lg text-center space-y-sm">
        <p className="text-xs text-muted-foreground">
          Built for Ugandan entrepreneurs • No hidden fees • Cancel anytime
        </p>
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          <a href="#" className="hover:text-foreground transition-colors">Support</a>
        </div>
      </footer>
    </Layout>
  );
};

export default Index;
