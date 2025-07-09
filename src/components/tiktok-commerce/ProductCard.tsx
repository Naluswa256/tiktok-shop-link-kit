
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Card, CardContent } from "@/components/ui/card";

export interface ProductCardProps {
  title: string;
  price: string;
  currency?: string;
  imageUrl: string;
  imageAlt?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  className?: string;
  isLoading?: boolean;
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(
  ({ 
    title, 
    price, 
    currency = "₵", 
    imageUrl, 
    imageAlt = "", 
    ctaText = "Buy on WhatsApp",
    onCtaClick,
    className,
    isLoading = false,
    ...props 
  }, ref) => {
    return (
      <Card 
        ref={ref}
        className={cn(
          "overflow-hidden transition-shadow hover:shadow-elevation-md",
          "group cursor-pointer",
          className
        )}
        {...props}
      >
        <div className="aspect-square overflow-hidden bg-muted">
          {isLoading ? (
            <div className="w-full h-full bg-muted animate-pulse" />
          ) : (
            <img
              src={imageUrl}
              alt={imageAlt || `${title} product image`}
              className="object-cover w-full h-full transition-transform group-hover:scale-105"
              loading="lazy"
            />
          )}
        </div>
        
        <CardContent className="p-md space-y-sm">
          <div className="space-y-1">
            <h3 className="font-semibold text-base line-clamp-2 leading-tight">
              {title}
            </h3>
            <p className="text-lg font-bold text-primary">
              {currency}{price}
            </p>
          </div>
          
          <Button
            variant="accent"
            size="block"
            onClick={onCtaClick}
            disabled={isLoading}
            className="w-full mt-sm"
          >
            {ctaText}
          </Button>
        </CardContent>
      </Card>
    );
  }
);

ProductCard.displayName = "ProductCard";

export { ProductCard };
