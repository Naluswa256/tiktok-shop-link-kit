
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles with mobile-first approach
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ds-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // BuyLink UG specific variants
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevation-sm active:shadow-none",
        secondary: "border border-secondary bg-background text-secondary hover:bg-secondary/5 shadow-elevation-sm",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-elevation-sm font-semibold",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Mobile-optimized sizes with adequate tap targets
        default: "h-12 px-lg py-2", // 48px height for mobile tap target
        sm: "h-10 rounded-ds-sm px-md",
        lg: "h-14 rounded-ds-lg px-xl text-base font-semibold",
        icon: "h-12 w-12", // Square tap target
        block: "h-12 w-full px-lg py-2", // Full width for mobile forms
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
