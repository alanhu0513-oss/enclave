import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/60 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-green text-black shadow-[0_0_24px_rgba(0,255,136,0.25)] hover:shadow-[0_0_32px_rgba(0,255,136,0.45)] hover:bg-[#33ffa1]",
        cyan: "bg-cyan text-black shadow-[0_0_24px_rgba(0,191,255,0.25)] hover:bg-[#33ccff]",
        destructive: "bg-red text-white shadow-glow-red hover:bg-[#ff5c6a]",
        outline:
          "border border-white/12 bg-white/[0.03] text-ink hover:bg-white/[0.07] hover:border-green/40",
        ghost: "text-ink-muted hover:text-ink hover:bg-white/[0.06]",
        glass:
          "glass-strong text-ink hover:border-green/40 hover:text-green",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
        iconSm: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
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
