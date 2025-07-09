
import * as React from "react";
import { cn } from "@/lib/utils";

export interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const Layout = React.forwardRef<HTMLDivElement, LayoutProps>(
  ({ children, className, header, footer, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("min-h-screen flex flex-col bg-background", className)}
        {...props}
      >
        {header && (
          <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="container-mobile">
              {header}
            </div>
          </header>
        )}
        
        <main className="flex-1">
          <div className="container-mobile py-lg">
            {children}
          </div>
        </main>
        
        {footer && (
          <footer className="border-t bg-muted/30">
            <div className="container-mobile py-lg">
              {footer}
            </div>
          </footer>
        )}
      </div>
    );
  }
);

Layout.displayName = "Layout";

export { Layout };
