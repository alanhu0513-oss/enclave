import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  FileText,
  Mail,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TakedownTimelineProps {
  takedownId: string;
  alertId: string;
}

interface TimelineEntry {
  at: string;
  step: string;
  urlLive?: boolean | null;
  result: string;
}

const STEP_LABELS: Record<string, { label: string; icon: typeof Clock }> = {
  "verification 24h": { label: "24h Verification", icon: CheckCircle2 },
  "reminder 48h": { label: "48h Reminder (TAKE IT DOWN Act)", icon: Mail },
  "final notice 7d": { label: "7-Day Final Notice", icon: AlertTriangle },
  "escalation 14d": { label: "14-Day Escalation", icon: Shield },
  "close 30d": { label: "30-Day Close", icon: FileText },
  "counter_notice": { label: "Counter-Notice Received", icon: AlertTriangle },
  "counter_expiry": { label: "Counter-Notice Expired", icon: CheckCircle2 },
};

export function TakedownTimeline({ takedownId }: TakedownTimelineProps) {
  const [evidence, setEvidence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getTakedownEvidence(takedownId)
      .then((d) => active && setEvidence(d))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [takedownId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-ink-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading evidence chain…
      </div>
    );
  }

  const logs: TimelineEntry[] = evidence?.verificationLog || [];
  const chainValid = evidence?.chainValid;
  const chainHead = evidence?.chainHead;
  const artifacts = evidence?.artifacts || 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden border-t border-white/[0.06] bg-white/[0.01]"
    >
      <div className="space-y-3 p-4">
        {/* Evidence integrity */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan" />
            <span className="text-xs font-medium text-ink">Evidence Chain</span>
          </div>
          {chainValid === true ? (
            <Badge variant="green" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </Badge>
          ) : chainValid === false ? (
            <Badge variant="red" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Tampered
            </Badge>
          ) : (
            <Badge variant="muted">No chain</Badge>
          )}
          {chainHead && (
            <span className="font-mono text-[10px] text-ink-faint" title={chainHead}>
              SHA-256: {chainHead.slice(0, 12)}…
            </span>
          )}
          <span className="text-[10px] text-ink-faint">
            {artifacts} artifact{artifacts !== 1 ? "s" : ""} preserved
          </span>
        </div>

        {/* Verification timeline */}
        {logs.length > 0 && (
          <div className="space-y-0">
            <p className="mb-2 text-xs font-medium text-ink-muted">Verification Timeline</p>
            {logs.map((entry, i) => {
              const meta = STEP_LABELS[entry.step] || { label: entry.step, icon: Clock };
              const StepIcon = meta.icon;
              return (
                <div key={i} className="flex gap-3">
                  {/* Line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        i === logs.length - 1
                          ? "bg-cyan/15 text-cyan"
                          : "bg-white/[0.05] text-ink-faint"
                      )}
                    >
                      <StepIcon className="h-3 w-3" />
                    </div>
                    {i < logs.length - 1 && (
                      <div className="w-px flex-1 bg-white/[0.08]" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-4">
                    <p className="text-xs font-medium text-ink">{meta.label}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {entry.result}
                      {entry.urlLive === true && (
                        <span className="ml-1 text-amber">· Content still live</span>
                      )}
                      {entry.urlLive === false && (
                        <span className="ml-1 text-green">· Content removed</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-faint">
                      {new Date(entry.at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {logs.length === 0 && (
          <p className="text-xs text-ink-muted">
            No verification steps yet. Enclave will re-crawl at 24h and 48h.
          </p>
        )}
      </div>
    </motion.div>
  );
}
