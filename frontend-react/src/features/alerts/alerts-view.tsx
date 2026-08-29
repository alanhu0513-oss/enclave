import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  Loader2,
  ShieldX,
  ShieldCheck,
  FileText,
  Trash2,
  BellOff,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api, type Alert } from "@/lib/api";
import { usePsychology } from "@/lib/psychology";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { confidenceColor, confidenceLabel, timeAgo } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "Review", color: "var(--amber)" },
  UNRESOLVED: { label: "Open", color: "var(--red)" },
  RESOLVED_SAFE: { label: "Safe", color: "var(--green)" },
  NOTICE_GENERATED: { label: "Notice sent", color: "var(--cyan)" },
  RESOLVED: { label: "Resolved", color: "var(--green)" },
};

export function AlertsView() {
  const { toast } = useApp();
  const psych = usePsychology();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e: any) {
      toast({ title: "Could not load alerts", body: e.message, variant: "error" });
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function takedown(a: Alert) {
    setAction(a.id);
    try {
      await api.initiateTakedown(a.id, "dmca");
      psych.recordTakedown();
      psych
        .checkBadges(5)
        .forEach((name) => toast({ title: `🏆 Badge unlocked: ${name}!`, variant: "success" }));
      toast({
        title: "Takedown initiated",
        body: a.url || a.description || "Request filed",
        variant: "success",
      });
    } catch (e: any) {
      toast({ title: "Takedown failed", body: e.message, variant: "error" });
    } finally {
      setAction(null);
    }
  }

  async function whitelist(a: Alert) {
    setAction(a.id);
    try {
      await api.whitelistAlert(a.id);
      toast({ title: "Marked as safe", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setAction(null);
    }
  }

  async function remove(a: Alert) {
    setAction(a.id);
    try {
      await api.deleteAlert(a.id);
      toast({ title: "Alert deleted", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red/15 text-red">
            <ShieldX className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Alert Center</h2>
            <p className="text-sm text-ink-muted">
              Detected threats to your identity
            </p>
          </div>
        </div>
        <Button variant="glass" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ShieldCheck className="h-12 w-12 text-green" />
            <div>
              <p className="text-sm font-semibold text-ink">All clear</p>
              <p className="text-xs text-ink-muted">
                No threats detected. Your identity is protected.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <StaggerContainer className="space-y-3">
          <AnimatePresence>
            {alerts.map((a) => {
              const conf = a.confidence ?? 0;
              const isCritical = conf >= 80;
              return (
                <StaggerItem key={a.id}>
                  <Card
                    className={
                      "transition-all duration-300 " + (isCritical ? "border-red/30" : "")
                    }
                  >
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: confidenceColor(conf) + "18", color: confidenceColor(conf) }}
                      >
                        {isCritical ? (
                          <ShieldX className="h-5 w-5" />
                        ) : (
                          <ShieldCheck className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-ink">
                            {a.url || a.description || "Detection"}
                          </p>
                          <Badge
                            variant={
                              conf >= 80 ? "red" : conf >= 50 ? "amber" : "green"
                            }
                          >
                            {confidenceLabel(conf)}
                          </Badge>
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                          {timeAgo(a.created_at)}
                          {a.type ? ` · ${a.type}` : ""}
                          {a.status && STATUS_META[a.status] && (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                color: STATUS_META[a.status].color,
                                background: STATUS_META[a.status].color + "1a",
                              }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: STATUS_META[a.status].color }}
                              />
                              {STATUS_META[a.status].label}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="mr-1 font-display text-sm font-bold"
                          style={{ color: confidenceColor(conf) }}
                        >
                          {Math.round(conf)}%
                        </span>
                        <Button size="sm" onClick={() => takedown(a)} disabled={action === a.id}>
                          {action === a.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          Takedown
                        </Button>
                        <Button
                          size="iconSm"
                          variant="ghost"
                          onClick={() => whitelist(a)}
                          title="Mark safe"
                        >
                          <BellOff className="h-4 w-4" />
                        </Button>
                        <Button
                          size="iconSm"
                          variant="ghost"
                          onClick={() => remove(a)}
                          title="Delete"
                          className="text-red/70 hover:text-red"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </AnimatePresence>
        </StaggerContainer>
      )}
    </div>
  );
}
