import { useEffect, useState } from "react";
import {
  Radar,
  Play,
  Square,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Shield,
  Globe,
  MessageSquare,
  FileText,
  Eye,
  Lock,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

interface SourceHealth {
  id: string;
  label: string;
  enabled: boolean;
  status: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  totalRuns: number;
  totalFindings: number;
  cooldownRemainingMin: number;
  requiredTier: string | null;
}

interface MonitoringStatus {
  active: boolean;
  tier: string;
  schedule: string;
  intervalMinutes: number | null;
  nextRunAt: string | null;
  cyclesCompleted: number;
  sources: SourceHealth[];
}

const SOURCE_ICONS: Record<string, typeof Globe> = {
  web: Globe,
  reddit: MessageSquare,
  paste: FileText,
  darkweb: Eye,
  social: Shield,
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  idle: { label: "Idle", color: "text-ink-muted", icon: Clock },
  ok: { label: "Active", color: "text-green", icon: CheckCircle2 },
  degraded: { label: "Degraded", color: "text-amber", icon: AlertTriangle },
  down: { label: "Down", color: "text-red", icon: AlertTriangle },
  cooldown: { label: "Cooldown", color: "text-amber", icon: Clock },
  locked: { label: "Locked", color: "text-ink-faint", icon: Lock },
};

export function MonitoringView() {
  const { toast } = useApp();
  const { user } = useAuth();
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [runningOnce, setRunningOnce] = useState(false);
  const plan = (user as any)?.plan || "free";

  async function load() {
    try {
      const data = await api.getMonitoringStatus();
      setStatus(data);
    } catch (e: any) {
      toast({ title: "Could not load monitoring", body: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Poll every 30s when active
    const interval = setInterval(() => {
      if (status?.active) load();
    }, 30000);
    return () => clearInterval(interval);
  }, [status?.active]);

  async function start() {
    setBusy(true);
    try {
      await api.startMonitoring();
      toast({ title: "Monitoring started", variant: "success" });
      await load();
    } catch (e: any) {
      toast({ title: "Failed to start", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await api.stopMonitoring();
      toast({ title: "Monitoring stopped", variant: "success" });
      await load();
    } catch (e: any) {
      toast({ title: "Failed to stop", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function runOnce() {
    setRunningOnce(true);
    try {
      const result = await api.runMonitoringOnce();
      toast({
        title: "Scan complete",
        body: `${(result as any)?.findings ?? 0} finding(s), ${(result as any)?.newAlerts ?? 0} new alert(s)`,
        variant: "success",
      });
      await load();
    } catch (e: any) {
      toast({ title: "Scan failed", body: e.message, variant: "error" });
    } finally {
      setRunningOnce(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const sources = status?.sources || [];
  const activeCount = sources.filter((s) => s.enabled && ["ok", "cooldown"].includes(s.status)).length;
  const findingsCount = sources.reduce((sum, s) => sum + s.totalFindings, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Live Monitoring</h2>
            <p className="text-sm text-ink-muted">
              {status?.active
                ? `Running · ${status.schedule} · Next: ${status.nextRunAt ? new Date(status.nextRunAt).toLocaleTimeString() : "—"}`
                : "Start proactive monitoring to detect threats across the web"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="glass" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {status?.active ? (
            <Button variant="destructive" onClick={stop} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              Stop
            </Button>
          ) : (
            <Button onClick={start} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start Monitoring
            </Button>
          )}
          <Button
            variant="cyan"
            onClick={runOnce}
            disabled={runningOnce || busy}
          >
            {runningOnce ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Run Now
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <StaggerContainer className="grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", status?.active ? "bg-green/15 text-green" : "bg-white/[0.05] text-ink-faint")}>
                <Radar className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ink">{status?.active ? "Active" : "Inactive"}</p>
                <p className="text-xs text-ink-muted">{status?.schedule || "Manual only"}</p>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
                <Eye className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ink">{activeCount}/{sources.length}</p>
                <p className="text-xs text-ink-muted">Sources active</p>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/15 text-amber">
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ink">{findingsCount}</p>
                <p className="text-xs text-ink-muted">Total findings</p>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Source grid */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold text-ink">Source Health</h3>
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => {
            const meta = STATUS_META[s.status] || STATUS_META.idle;
            const StatusIcon = meta.icon;
            const SourceIcon = SOURCE_ICONS[s.id] || Globe;
            return (
              <StaggerItem key={s.id}>
                <Card className={cn(!s.enabled && "opacity-50")}>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SourceIcon className="h-4 w-4 text-cyan" />
                        <p className="text-sm font-medium text-ink">{s.label}</p>
                      </div>
                      <span className={cn("flex items-center gap-1 text-xs", meta.color)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-ink-muted">
                      <div className="flex justify-between">
                        <span>Runs</span>
                        <span className="text-ink">{s.totalRuns}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Findings</span>
                        <span className="text-ink">{s.totalFindings}</span>
                      </div>
                      {s.lastSuccessAt && (
                        <div className="flex justify-between">
                          <span>Last success</span>
                          <span className="text-ink">{new Date(s.lastSuccessAt).toLocaleString()}</span>
                        </div>
                      )}
                      {s.lastError && (
                        <p className="mt-1 truncate text-[11px] text-red" title={s.lastError}>
                          {s.lastError}
                        </p>
                      )}
                      {!s.enabled && s.requiredTier && (
                        <Badge variant="muted" className="mt-1">
                          Requires {s.requiredTier}
                        </Badge>
                      )}
                      {s.cooldownRemainingMin > 0 && (
                        <p className="text-[11px] text-amber">
                          Cooldown: {s.cooldownRemainingMin}m remaining
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>

      {/* Free tier upsell */}
      {plan === "free" && (
        <Card className="border-cyan/20 bg-cyan/[0.03]">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:gap-6">
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Upgrade for continuous monitoring</p>
              <p className="mt-1 text-xs text-ink-muted">
                Free plan only runs surface web checks every 6 hours. Pro monitors hourly across web,
                Reddit, and paste sites. Shield adds dark web. Business adds 15-minute cycles + social.
              </p>
            </div>
            <Button variant="cyan" onClick={() => window.dispatchEvent(new CustomEvent("enclave:open-plans"))}>
              See plans
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
