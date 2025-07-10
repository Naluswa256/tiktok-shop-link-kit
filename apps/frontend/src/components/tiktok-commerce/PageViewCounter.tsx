
import * as React from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageViewCounterProps {
  count: number;
  className?: string;
  showIcon?: boolean;
}

const PageViewCounter = React.forwardRef<HTMLDivElement, PageViewCounterProps>(
  ({ count, className, showIcon = true, ...props }, ref) => {
    // Format the count for display (1.2k, 1.2M, etc.)
    const formatCount = (num: number): string => {
      if (num < 1000) return num.toString();
      if (num < 1000000) return `${(num / 1000).toFixed(1)}k`;
      return `${(num / 1000000).toFixed(1)}M`;
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-xs px-sm py-1 rounded-ds-sm bg-muted/80 text-muted-foreground text-xs font-medium",
          className
        )}
        {...props}
      >
        {showIcon && <Eye className="h-3 w-3" />}
        <span>{formatCount(count)} views</span>
      </div>
    );
  }
);

PageViewCounter.displayName = "PageViewCounter";

export { PageViewCounter };
