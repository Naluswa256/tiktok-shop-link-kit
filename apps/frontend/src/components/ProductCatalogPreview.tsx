
import React, { useState } from 'react';
import { ProductCard } from '@/components/tiktok-commerce';
import { Eye, MessageCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const mockProducts = [
  {
    id: 1,
    title: "Kampala Fashion Heels",
    price: "55,000",
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=200&fit=crop&auto=format&q=80",
    views: 234
  },
  {
    id: 2,
    title: "African Print Bag",
    price: "45,000",
    imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=200&fit=crop&auto=format&q=80",
    views: 189
  },
  {
    id: 3,
    title: "Gomesi Modern Style",
    price: "120,000",
    imageUrl: "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=200&h=200&fit=crop&auto=format&q=80",
    views: 312
  },
  {
    id: 4,
    title: "Ugandan Jewelry Set",
    price: "35,000",
    imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=200&h=200&fit=crop&auto=format&q=80",
    views: 156
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
