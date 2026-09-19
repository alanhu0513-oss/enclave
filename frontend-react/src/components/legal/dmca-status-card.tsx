import React from "react";
import { motion } from "motion/react";
import { 
  Clock, 
  Calendar, 
  ExternalLink, 
  Globe, 
  CheckCircle2, 
  ShieldAlert,
  Hash,
  Scale
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DMCAStatus = "pending" | "in_progress" | "resolved" | "sent" | "acknowledged" | "removed" | "escalated" | string;

export interface DMCAActionSummary {
  id: string;
  platform?: string;
  submissionDate?: string | number | Date;
  status: DMCAStatus;
  targetUrl?: string;
  type?: string;
  abuseEmail?: string;
  evidenceHash?: string;
  caseId?: string;
  recipientOrg?: string;
}

interface DMCAStatusCardProps {
  takedown: DMCAActionSummary;
  className?: string;
  onStatusChange?: (newStatus: "pending" | "in_progress" | "resolved") => void;
  showControls?: boolean;
}

export function normalizeStatus(status?: string): "pending" | "in_progress" | "resolved" {
  if (!status) return "pending";
  const s = status.toLowerCase();
  if (s === "resolved" || s === "removed" || s === "completed") return "resolved";
  if (s === "in_progress" || s === "in progress" || s === "acknowledged" || s === "escalated" || s === "sent") {
    return "in_progress";
  }
  return "pending";
}

export const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    sublabel: "Notice Filed & Transmission Queued",
    color: "amber",
    borderClass: "border-amber-500/30",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-400",
    badgeVariant: "amber" as const,
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    sublabel: "Platform Acknowledged & Under Active Review",
    color: "cyan",
    borderClass: "border-cyan/35",
    bgClass: "bg-cyan/10",
    textClass: "text-cyan",
    badgeVariant: "cyan" as const,
    icon: ShieldAlert,
  },
  resolved: {
    label: "Resolved",
    sublabel: "Infringing Material Removed by Host",
    color: "green",
    borderClass: "border-green/35",
    bgClass: "bg-green/10",
    textClass: "text-green",
    badgeVariant: "green" as const,
    icon: CheckCircle2,
  },
};

export function DMCAStatusCard({
  takedown,
  className,
  onStatusChange: _onStatusChange,
  showControls: _showControls = true,
}: DMCAStatusCardProps) {
  const normStatus = normalizeStatus(takedown.status);
  const currentConfig = STATUS_CONFIG[normStatus];
  const StatusIcon = currentConfig.icon;

  const formattedDate = React.useMemo(() => {
    if (!takedown.submissionDate) return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    try {
      const d = typeof takedown.submissionDate === "number" || typeof takedown.submissionDate === "string"
        ? new Date(takedown.submissionDate)
        : takedown.submissionDate;
      return isNaN(d.getTime()) 
        ? String(takedown.submissionDate)
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return String(takedown.submissionDate);
    }
  }, [takedown.submissionDate]);

  const platformDisplay = takedown.platform || "X (Twitter) CDN / Cloudflare";
  const caseIdDisplay = takedown.caseId || `#ENC-DMCA-${(takedown.id || "8920").slice(0, 8).toUpperCase()}`;

  return (
    <motion.div
      layout
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-[#080a10]/90 backdrop-blur-xl p-6 transition-all duration-300",
        currentConfig.borderClass,
        className
      )}
    >
      {/* Subtle background status ambient glow */}
      <div 
        className={cn(
          "pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl opacity-20 transition-all duration-700",
          normStatus === "pending" && "bg-amber-500",
          normStatus === "in_progress" && "bg-cyan",
          normStatus === "resolved" && "bg-green"
        )} 
      />

      <div className="relative z-10 space-y-5">
        {/* Top Header Row: Platform & Current Status */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-cyan shadow-inner">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-ink-muted uppercase">Target Platform</span>
                <span className="inline-flex items-center rounded-full bg-cyan/15 px-2 py-0.5 text-[9px] font-mono font-medium text-cyan">
                  VERIFIED HOST
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-ink tracking-tight">
                {platformDisplay}
              </h3>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <motion.div
              key={normStatus}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  normStatus === "pending" && "bg-amber-400",
                  normStatus === "in_progress" && "bg-cyan",
                  normStatus === "resolved" && "bg-green"
                )} />
                <span className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  normStatus === "pending" && "bg-amber-500",
                  normStatus === "in_progress" && "bg-cyan",
                  normStatus === "resolved" && "bg-green"
                )} />
              </span>

              <Badge
                variant={currentConfig.badgeVariant as any}
                className="font-mono text-xs uppercase tracking-wider px-2.5 py-1 font-semibold flex items-center gap-1.5"
              >
                <StatusIcon className="h-3 w-3" />
                {currentConfig.label}
              </Badge>
            </motion.div>
            <span className="font-mono text-[10px] text-ink-faint">
              {currentConfig.sublabel}
            </span>
          </div>
        </div>

        {/* Data Grid: Submission Date, Case ID, Statutory Basis */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-1.5 text-ink-faint text-[10px] uppercase tracking-wider">
              <Calendar className="h-3 w-3 text-cyan" />
              Submission Date
            </div>
            <p className="mt-1 font-medium text-ink font-sans text-sm">
              {formattedDate}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-1.5 text-ink-faint text-[10px] uppercase tracking-wider">
              <Hash className="h-3 w-3 text-cyan" />
              Case Dossier ID
            </div>
            <p className="mt-1 font-medium text-cyan text-xs tracking-wider">
              {caseIdDisplay}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-1.5 text-ink-faint text-[10px] uppercase tracking-wider">
              <Scale className="h-3 w-3 text-green" />
              Statutory Basis
            </div>
            <p className="mt-1 font-medium text-ink font-sans text-xs">
              17 U.S.C. § 512(c) / DMCA
            </p>
          </div>
        </div>

        {/* Target URL / Infringing locator bar */}
        {takedown.targetUrl && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/40 px-3.5 py-2.5 font-mono text-xs text-ink-muted">
            <div className="flex items-center gap-2 truncate">
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-cyan" />
              <span className="text-ink-faint shrink-0">Infringing URL:</span>
              <span className="truncate text-ink hover:text-cyan transition-colors select-all">
                {takedown.targetUrl}
              </span>
            </div>
            {takedown.evidenceHash && (
              <span className="hidden sm:inline-block text-[10px] text-ink-faint shrink-0">
                Hash: {takedown.evidenceHash.slice(0, 16)}…
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
