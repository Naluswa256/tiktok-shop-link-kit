
import React from 'react';
import { ProductCard } from '@/components/tiktok-commerce';
import { Eye, Share } from 'lucide-react';

export const PhoneMockup = () => {
  return (
    <div className="relative max-w-xs mx-auto">
      {/* Phone Frame */}
      <div className="bg-neutral-800 rounded-[2rem] p-2 shadow-elevation-lg">
        <div className="bg-background rounded-[1.5rem] overflow-hidden">
          {/* Phone Header */}
          <div className="bg-background border-b px-md py-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">nalu-fashion</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="w-3 h-3" />
                <span>1.2k</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              tiktokshop.ug/shop/nalu-fashion
            </div>
          </div>

          {/* Phone Content */}
          <div className="p-sm space-y-sm h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-xs">
              <ProductCard
                title="New Heels Collection"
                price="55,000"
                imageUrl="https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=200&fit=crop"
                ctaText="Buy Now"
                className="text-xs"
              />
              <ProductCard
                title="Designer Handbag"
                price="85,000"
                imageUrl="https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&h=200&fit=crop"
                ctaText="Buy Now"
                className="text-xs"
              />
              <ProductCard
                title="Summer Dress"
                price="45,000"
                imageUrl="https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=200&h=200&fit=crop"
                ctaText="Buy Now"
                className="text-xs"
              />
              <ProductCard
                title="Fashion Accessories"
                price="25,000"
                imageUrl="https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=200&h=200&fit=crop"
                ctaText="Buy Now"
                className="text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Share Badge */}
      <div className="absolute -top-2 -right-2 bg-accent text-accent-foreground px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-elevation-sm">
        <Share className="w-3 h-3" />
        Shareable
      </div>
    </div>
  );
};
