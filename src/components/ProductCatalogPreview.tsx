
import React, { useState } from 'react';
import { ProductCard } from '@/components/tiktok-commerce';
import { Eye, MessageCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const mockProducts = [
  {
    id: 1,
    title: "New Heels Collection",
    price: "55,000",
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=200&fit=crop",
    views: 123
  },
  {
    id: 2,
    title: "Designer Handbag",
    price: "85,000",
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&h=200&fit=crop",
    views: 89
  },
  {
    id: 3,
    title: "Summer Dress",
    price: "45,000",
    imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=200&h=200&fit=crop",
    views: 156
  },
  {
    id: 4,
    title: "Fashion Accessories",
    price: "25,000",
    imageUrl: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=200&h=200&fit=crop",
    views: 67
  }
];

export const ProductCatalogPreview = () => {
  const [hoveredProduct, setHoveredProduct] = useState<number | null>(null);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-sm max-w-sm mx-auto">
        {mockProducts.map((product) => (
          <Tooltip key={product.id}>
            <TooltipTrigger asChild>
              <div
                className={`transform transition-all duration-200 ${
                  hoveredProduct === product.id ? 'scale-105' : 'hover:scale-105'
                }`}
                onMouseEnter={() => setHoveredProduct(product.id)}
                onMouseLeave={() => setHoveredProduct(null)}
              >
                <ProductCard
                  title={product.title}
                  price={product.price}
                  currency="UGX "
                  imageUrl={product.imageUrl}
                  ctaText="Buy Now"
                  className="cursor-pointer"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs">
                  <MessageCircle className="w-3 h-3" />
                  <span>Click to buy on WhatsApp</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3" />
                  <span>Page views: {product.views}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
