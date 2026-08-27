import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BADGE_DEFS } from "@/lib/psychology";
import { Badge } from "@/components/ui/badge";

export function BadgesGrid({ unlockedIds }: { unlockedIds: string[] }) {
  const unlockedSet = new Set(unlockedIds);
  const count = unlockedIds.length;
  const total = BADGE_DEFS.length;
  const pct = Math.round((count / total) * 100);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
          Achievements
        </p>
        <Badge variant="purple">
          {count} / {total}
        </Badge>
      </div>

      {/* progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-green to-cyan"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {BADGE_DEFS.map((b, i) => {
          const unlocked = unlockedSet.has(b.id);
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              title={b.desc}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all",
                unlocked
                  ? "border-green/30 bg-green/[0.06]"
                  : "border-white/[0.06] bg-white/[0.02] opacity-50 grayscale"
              )}
            >
              <span
                className={cn(
                  "text-xl",
                  unlocked && "drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]"
                )}
              >
                {unlocked ? b.icon : <Lock className="h-5 w-5 text-ink-faint" />}
              </span>
              <span className="text-[10px] font-medium leading-tight text-ink-muted">
                {b.name}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
