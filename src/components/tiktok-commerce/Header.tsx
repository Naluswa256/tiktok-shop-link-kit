
import * as React from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface HeaderProps {
  title?: string;
  logo?: React.ReactNode;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
  className?: string;
}

const Header = React.forwardRef<HTMLDivElement, HeaderProps>(
  ({ title, logo, actions, onMenuClick, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between h-16 px-md",
          className
        )}
        {...props}
      >
        {/* Left section - Logo or Menu */}
        <div className="flex items-center gap-md">
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          {logo || (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-ds-sm flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">T</span>
              </div>
              {title && (
                <span className="font-bold text-lg text-foreground">
                  {title}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right section - Actions */}
        {actions && (
          <div className="flex items-center gap-sm">
            {actions}
          </div>
        )}
      </div>
    );
  }
);

Header.displayName = "Header";

export { Header };
