import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StaggerItem, Kinetic, SPRING } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function AnimatedNumber({ value, className, prefix = "", suffix = "" }: {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 800;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span className={className}>{prefix}{display.toLocaleString()}{suffix}</span>;
}

export function StatCard({ icon: Icon, label, value, color = "cyan", suffix, className }: {
  icon: LucideIcon;
  label: string;
  value: number;
  color?: string;
  suffix?: string;
  className?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; shadow: string }> = {
    green: { bg: "bg-green/15", text: "text-green", shadow: "hover:shadow-green/10" },
    cyan: { bg: "bg-cyan/15", text: "text-cyan", shadow: "hover:shadow-cyan/10" },
    amber: { bg: "bg-amber/15", text: "text-amber", shadow: "hover:shadow-amber/10" },
    red: { bg: "bg-red/15", text: "text-red", shadow: "hover:shadow-red/10" },
    purple: { bg: "bg-purple/15", text: "text-purple", shadow: "hover:shadow-purple/10" },
  };
  const c = colorMap[color] || colorMap.cyan;

  return (
    <StaggerItem>
      <Kinetic>
        <Card className={cn("transition-shadow hover:shadow-lg", c.shadow, className)}>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", c.bg, c.text)}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <AnimatedNumber value={value} className="text-2xl font-bold text-ink" suffix={suffix} />
              <p className="text-sm text-ink-muted">{label}</p>
            </div>
          </CardContent>
        </Card>
      </Kinetic>
    </StaggerItem>
  );
}

export function SectionHeader({ icon: Icon, title, description, action }: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: -10, scale: 1.1 }}
          transition={SPRING}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green/20 to-cyan/20 text-green"
        >
          <Icon className="h-6 w-6" />
        </motion.div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
          {description && <p className="text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-ink-faint"
      >
        <Icon className="h-10 w-10" />
      </motion.div>
      <h3 className="mb-1 text-lg font-semibold text-ink">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-ink-muted">{description}</p>
      {action}
    </div>
  );
}

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className={cn("animate-spin text-cyan", sizeMap[size])} />
    </div>
  );
}

export function GradientCard({ children, className, gradient = "from-green/5 to-cyan/5" }: {
  children: React.ReactNode;
  className?: string;
  gradient?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", gradient)} />
      <div className="relative">{children}</div>
    </Card>
  );
}

export function PulseDot({ color = "green", size = "md" }: {
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = { sm: "h-2 w-2", md: "h-3 w-3", lg: "h-4 w-4" };
  return (
    <span className="relative flex items-center justify-center">
      <span className={cn("absolute animate-ping rounded-full opacity-75", sizeMap[size], `bg-${color}`)} />
      <span className={cn("relative rounded-full", sizeMap[size], `bg-${color}`)} />
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const colors: Record<string, string> = {
    active: "green",
    online: "green",
    healthy: "green",
    warning: "amber",
    degraded: "amber",
    error: "red",
    offline: "red",
    pending: "cyan",
    inactive: "muted",
  };
  const color = colors[status] || "muted";

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
      `bg-${color}/15 text-${color} border border-${color}/30`
    )}>
      <PulseDot color={color} size="sm" />
      {label || status}
    </span>
  );
}
