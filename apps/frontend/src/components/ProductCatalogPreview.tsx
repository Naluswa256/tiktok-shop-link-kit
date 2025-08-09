
import React, { useState } from 'react';
import { ProductCard } from '@/components/tiktok-commerce';
import { Eye, MessageCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const mockProducts = [
  {
    id: 1,
    title: "Mens Shoes",
    price: "55,000",
    imageUrl: "https://merchandiseuganda.com/girogup/2021/09/WhatsApp-Image-2021-09-02-at-8.31.35-PM-750x450.jpeg",
    views: 234
  },
  {
    id: 2,
    title: "Laptop",
    price: "450,000",
    imageUrl: "https://ug.jumia.is/unsafe/fit-in/680x680/filters:fill(white)/product/86/3629752/1.jpg?0324",
    views: 189
  },
  {
    id: 3,
    title: "iPhone 13 256GB - Pink in Uganda",
    price: "2,700,000",
    imageUrl: "https://istoreuganda.com/wp-content/uploads/2023/04/iPhone13_Pink_2048x.webp",
    views: 312
  },
  {
    id: 4,
    title: "Hisense 43 Inch Digital TV",
    price: "685,000",
    imageUrl: "https://www.tilyexpress.ug/wp-content/uploads/2022/11/1-2022-11-10T225024.183-1024x1024.webp",
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
