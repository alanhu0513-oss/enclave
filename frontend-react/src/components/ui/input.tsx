import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-white/20 bg-white/[0.03] px-3.5 py-2 text-sm text-ink transition-all duration-200 ease-out placeholder:text-ink-faint/60 focus:border-green/50 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-green/20 focus:shadow-[0_0_16px_rgba(0,255,136,0.08)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
