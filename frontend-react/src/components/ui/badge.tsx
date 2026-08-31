import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors duration-200",
  {
    variants: {
      variant: {
        default: "bg-white/[0.06] text-ink-muted border border-white/10",
        green: "bg-gradient-to-r from-green/15 to-green/10 text-green border border-green/30",
        cyan: "bg-gradient-to-r from-cyan/15 to-cyan/10 text-cyan border border-cyan/30",
        red: "bg-gradient-to-r from-red/15 to-red/10 text-red border border-red/30",
        amber: "bg-gradient-to-r from-amber/15 to-amber/10 text-amber border border-amber/30",
        purple: "bg-gradient-to-r from-purple/15 to-purple/10 text-purple border border-purple/30",
        muted: "bg-white/[0.06] text-ink-muted border border-white/10",
        outline: "border border-white/15 text-ink-muted",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
