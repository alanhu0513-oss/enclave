import { motion } from "motion/react";
import { Clock, Lightbulb, AlertTriangle, TrendingUp } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import type { PsychologyState } from "@/lib/psychology";
import type { Alert } from "@/lib/api";

interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  desc: string;
}

export function generateInsights(
  psych: PsychologyState,
  shieldsActive: number,
  alerts: Alert[]
): Insight[] {
  const list: Insight[] = [];
  const critical = alerts.filter((a) => (a.confidence ?? 0) >= 80).length;

  if (shieldsActive < 3) {
    list.push({
      type: "warning",
      title: "Protection below recommended level",
      desc: `Only ${shieldsActive} of 5 shields active. Users with 3+ shields are 73% less likely to fall victim to identity theft.`,
    });
  }
  if (critical > 0) {
    list.push({
      type: "warning",
      title: `${critical} critical threat${critical > 1 ? "s" : ""} needs action`,
      desc: "Critical detections are 4x more likely to escalate. File a takedown now.",
    });
  }
  if (psych.streak >= 3) {
    list.push({
      type: "success",
      title: `Your ${psych.streak}-day streak is above average`,
      desc: "Consistent users catch 4x more threats. You're in the top 15% of active protectors.",
    });
  }
  if (psych.scans === 0) {
    list.push({
      type: "info",
      title: "Run your first scan",
      desc: "The average user finds 2.3 potential threats in their first scan. Try scanning a profile picture.",
    });
  } else if (psych.scans >= 10) {
    list.push({
      type: "success",
      title: `You've scanned ${psych.scans} items`,
      desc: "Power users like you are 5x more likely to catch deepfakes early. Keep it up!",
    });
  }

  const tips: Insight[] = [
    { type: "info", title: "Pro tip: Enable Camera Immunizer", desc: "It automatically protects every photo you take — no manual scanning needed." },
    { type: "info", title: "Pro tip: Schedule deep scans", desc: "Weekly deep scans catch 89% more threats than manual scans alone." },
    { type: "info", title: "Pro tip: Voice Shield protects calls", desc: "Real-time audio scrambling prevents voice cloning during calls." },
  ];
  list.push(tips[Math.floor(Math.random() * tips.length)]);

  return list.slice(0, 4);
}

const TYPE_STYLE = {
  warning: { icon: AlertTriangle, ring: "border-amber/25 bg-amber/[0.05]", iconCls: "text-amber" },
  success: { icon: TrendingUp, ring: "border-green/25 bg-green/[0.05]", iconCls: "text-green" },
  info: { icon: Lightbulb, ring: "border-cyan/25 bg-cyan/[0.05]", iconCls: "text-cyan" },
} as const;

export function InsightsList({ psych, shieldsActive, alerts }: {
  psych: PsychologyState;
  shieldsActive: number;
  alerts: Alert[];
}) {
  const insights = generateInsights(psych, shieldsActive, alerts);
  return (
    <div className="flex flex-col gap-2.5">
      {insights.map((ins, i) => {
        const s = TYPE_STYLE[ins.type];
        const Icon = s.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className={cn("flex items-start gap-3 rounded-xl border p-3", s.ring)}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconCls)} />
            <div>
              <p className="text-sm font-medium text-ink">{ins.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{ins.desc}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function ProtectionTimeline({
  createdAt,
  alerts,
}: {
  createdAt: number;
  alerts: Alert[];
}) {
  const days = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000));
  const hours = days * 24;
  const start = new Date(createdAt);
  const recent = alerts.slice(0, 5);

  return (
    <div>
      {/* Sunk-cost summary */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
          <Clock className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-display text-lg font-bold text-ink">
            {days} days<span className="text-sm font-normal text-ink-muted"> · {hours}h protected</span>
          </p>
          <p className="text-xs text-ink-faint">
            Shielded since {start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Detection timeline */}
      <div className="flex flex-col gap-3">
        {recent.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-faint">
            Your protection timeline will fill with detection history after your first scan.
          </p>
        ) : (
          recent.map((a, i) => {
            const conf = a.confidence ?? 0;
            const isThreat = conf >= 60;
            const isSusp = conf >= 40 && conf < 60;
            const dot = isThreat ? "bg-red" : isSusp ? "bg-cyan" : "bg-green";
            const label = isThreat ? "Threat detected" : isSusp ? "Suspicious scan" : "Scan — no threat";
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative flex items-start gap-3"
              >
                {i < recent.length - 1 && (
                  <span className="absolute left-[5px] top-3.5 h-full w-px bg-white/[0.08]" />
                )}
                <span className={cn("z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {label} ({Math.round(conf)}%) — {a.url || a.image || "scan"}
                  </p>
                  <p className="text-xs text-ink-faint">{timeAgo(a.created_at ?? a.timestamp)}</p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
