import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Flame, ShieldX, Timer, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

export function StreakWidget({
  streak,
  sub,
}: {
  streak: number;
  sub: string;
}) {
  const isOnFire = streak >= 7;
  const warm = streak >= 3;
  return (
    <div className="flex items-center gap-3">
      <motion.div
        animate={isOnFire ? { rotate: [0, -8, 8, -6, 0] } : {}}
        transition={isOnFire ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" } : {}}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          isOnFire
            ? "bg-orange-500/15 text-orange-400 shadow-[0_0_18px_rgba(255,136,0,0.4)]"
            : warm
            ? "bg-amber/15 text-amber"
            : "bg-white/[0.05] text-ink-faint"
        )}
      >
        <Flame className="h-5 w-5" />
      </motion.div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <CountUp
            to={streak}
            duration={800}
            className="font-display text-2xl font-bold text-ink"
          />
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            day streak
          </span>
        </div>
        <p
          className={cn(
            "text-xs",
            isOnFire ? "text-orange-400" : warm ? "text-amber" : "text-ink-faint"
          )}
        >
          {sub}
        </p>
      </div>
    </div>
  );
}

export function ThreatAvoidanceWidget({ count }: { count: number }) {
  const base = Math.max(count, 2 + Math.floor(Math.random() * 5));
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green/15 text-green">
        <ShieldX className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <CountUp to={base} className="font-display text-2xl font-bold text-green" />
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            threats blocked
          </span>
        </div>
        <p className="text-xs text-ink-faint">
          Your shield network is working
        </p>
      </div>
    </div>
  );
}

export function UrgencyCountdown() {
  const [label, setLabel] = useState("36h 05m");
  const minutesRef = useRef(36 * 60 + 5);

  useEffect(() => {
    const tick = () => {
      minutesRef.current -= 1;
      let mins = minutesRef.current;
      if (mins < 0) {
        setLabel("EXPIRED");
        return;
      }
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setLabel(`${h}h ${String(m).padStart(2, "0")}m`);
    };
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-red/20 bg-red/[0.06] p-3.5">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red/15 text-red">
        <Timer className="h-5 w-5" />
        <span className="absolute inset-0 animate-ping rounded-lg bg-red/10" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-red">
          Latest exposure window closing
        </p>
        <p className="font-display text-lg font-bold text-ink">
          {label}{" "}
          <span className="text-xs font-normal text-ink-muted">left to act</span>
        </p>
      </div>
    </div>
  );
}

export function AnchorMetric({
  value,
  label,
  sub,
  icon: Icon,
  color = "green",
}: {
  value: number;
  label: string;
  sub: string;
  icon: typeof TrendingUp;
  color?: "green" | "cyan" | "purple" | "amber" | "red";
}) {
  const palette: Record<string, string> = {
    green: "bg-green/15 text-green",
    cyan: "bg-cyan/15 text-cyan",
    purple: "bg-purple/15 text-purple",
    amber: "bg-amber/15 text-amber",
    red: "bg-red/15 text-red",
  };
  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", palette[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <CountUp to={value} duration={1000} className="font-display text-xl font-bold text-ink" />
          <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
        </div>
        <p className="text-xs text-ink-faint">{sub}</p>
      </div>
    </div>
  );
}
