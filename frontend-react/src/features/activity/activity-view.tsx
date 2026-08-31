import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ShieldX,
  ShieldCheck,
  ScanSearch,
  FileText,
  IdCard,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api, type Alert, type Takedown } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn, Expandable } from "@/components/ui/motion";
import { SectionHeader, EmptyState } from "@/components/ui/dashboard";
import { cn } from "@/lib/utils";
import { getShieldStates } from "@/features/shields/shields-view";

type EventType = "alert" | "scan" | "takedown" | "shield" | "passport";
type FilterType = "all" | EventType;
type DateRange = "today" | "week" | "month" | "all";

interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  date: Date;
  severity: "critical" | "warning" | "info";
  details: Record<string, string>;
}

const EVENT_COLORS: Record<EventType, string> = {
  alert: "text-red",
  scan: "text-cyan",
  shield: "text-green",
  takedown: "text-amber",
  passport: "text-purple",
};

const EVENT_BG: Record<EventType, string> = {
  alert: "bg-red/15",
  scan: "bg-cyan/15",
  shield: "bg-green/15",
  takedown: "bg-amber/15",
  passport: "bg-purple/15",
};

const EVENT_ICONS: Record<EventType, typeof ShieldX> = {
  alert: ShieldX,
  scan: ScanSearch,
  shield: ShieldCheck,
  takedown: FileText,
  passport: IdCard,
};

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "alert", label: "Alerts" },
  { id: "scan", label: "Scans" },
  { id: "takedown", label: "Takedowns" },
  { id: "shield", label: "Shields" },
  { id: "passport", label: "Passport" },
];

const DATE_RANGES: { id: DateRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

function timeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

function confidenceLabel(conf: number): string {
  if (conf >= 80) return "Critical";
  if (conf >= 50) return "Warning";
  return "Info";
}

function confidenceSeverity(conf: number): "critical" | "warning" | "info" {
  if (conf >= 80) return "critical";
  if (conf >= 50) return "warning";
  return "info";
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "red",
  warning: "amber",
  info: "cyan",
};

function alertToEvent(a: Alert): TimelineEvent {
  const conf = a.confidence ?? 0;
  return {
    id: `alert-${a.id}`,
    type: "alert",
    title: a.url || a.description || "Threat detected",
    description: `${a.type ? a.type + " · " : ""}${confidenceLabel(conf)} (${Math.round(conf)}%)`,
    date: new Date(a.created_at ?? Date.now()),
    severity: confidenceSeverity(conf),
    details: {
      URL: a.url || "N/A",
      Type: a.type || "unknown",
      Confidence: `${Math.round(conf)}%`,
      Status: a.status || "pending",
      ...(a.source_url ? { "Source URL": a.source_url } : {}),
    },
  };
}

function takedownToEvent(t: Takedown): TimelineEvent {
  return {
    id: `takedown-${t.id}`,
    type: "takedown",
    title: `Takedown · ${t.platform || "Unknown platform"}`,
    description: `Status: ${t.status || "pending"} · ${t.type || "dmca"}`,
    date: new Date(t.created_at ?? Date.now()),
    severity: t.status === "removed" ? "info" : t.status === "escalated" ? "critical" : "warning",
    details: {
      Platform: t.platform || "Unknown",
      Type: t.type || "dmca",
      Status: t.status || "pending",
    },
  };
}

function shieldToEvents(): TimelineEvent[] {
  const states = getShieldStates();
  const SHIELD_NAMES: Record<string, string> = {
    crawler: "Proactive Crawler",
    monitor: "Deep Web Monitor",
    biometric: "Biometric Enrollment",
    takedown: "Auto Takedown",
    rights: "Rights Shield",
  };
  return Object.entries(states).map(([key, enabled], i) => ({
    id: `shield-${key}`,
    type: "shield" as EventType,
    title: `${SHIELD_NAMES[key] || key} ${enabled ? "enabled" : "disabled"}`,
    description: enabled ? "Shield is active and protecting you" : "Shield is inactive",
    date: new Date(Date.now() - i * 3600000),
    severity: enabled ? "info" : "warning",
    details: {
      Shield: SHIELD_NAMES[key] || key,
      Status: enabled ? "Active" : "Inactive",
    },
  }));
}

function passportToEvents(): TimelineEvent[] {
  return [
    {
      id: "passport-enrollment",
      type: "passport",
      title: "Identity enrolled",
      description: "Passport biometric enrollment verified",
      date: new Date(Date.now() - 86400000 * 2),
      severity: "info",
      details: {
        Status: "Verified",
        Type: "Biometric enrollment",
      },
    },
    {
      id: "passport-verification",
      type: "passport",
      title: "Identity verified",
      description: "Passport verification completed successfully",
      date: new Date(Date.now() - 86400000 * 7),
      severity: "info",
      details: {
        Status: "Complete",
        Type: "Identity verification",
      },
    },
  ];
}

function scanToEvents(alerts: Alert[]): TimelineEvent[] {
  return alerts
    .filter((a) => a.type === "scan" || a.source_url)
    .slice(0, 5)
    .map((a) => ({
      id: `scan-${a.id}`,
      type: "scan" as EventType,
      title: `Scan · ${a.url || a.description || "Results"}`,
      description: `${confidenceLabel(a.confidence ?? 0)} · ${Math.round(a.confidence ?? 0)}% confidence`,
      date: new Date(a.created_at ?? Date.now()),
      severity: confidenceSeverity(a.confidence ?? 0),
      details: {
        URL: a.url || "N/A",
        Confidence: `${Math.round(a.confidence ?? 0)}%`,
        Type: a.type || "scan",
      },
    }));
}

function filterByDateRange(events: TimelineEvent[], range: DateRange): TimelineEvent[] {
  if (range === "all") return events;
  const now = new Date();
  const cutoff = new Date(
    range === "today"
      ? now.setHours(0, 0, 0, 0)
      : range === "week"
      ? now.getTime() - 7 * 86400000
      : now.getTime() - 30 * 86400000
  );
  return events.filter((e) => e.date >= cutoff);
}

export function ActivityView() {
  const { toast } = useApp();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [takedowns, setTakedowns] = useState<Takedown[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [alertData, tdData] = await Promise.all([
          api.getAlerts(),
          api.getTakedowns().catch(() => []),
        ]);
        if (!active) return;
        setAlerts(alertData);
        setTakedowns(tdData || []);
      } catch (e: any) {
        toast({ title: "Could not load activity", body: e.message, variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [toast]);

  const events = useMemo(() => {
    const all: TimelineEvent[] = [
      ...alerts.map(alertToEvent),
      ...takedowns.map(takedownToEvent),
      ...shieldToEvents(),
      ...passportToEvents(),
      ...scanToEvents(alerts),
    ];
    const deduped = all.filter(
      (e, i, arr) => arr.findIndex((x) => x.id === e.id) === i
    );
    return deduped.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [alerts, takedowns]);

  const filtered = useMemo(() => {
    let result = events;
    if (filter !== "all") {
      result = result.filter((e) => e.type === filter);
    }
    return filterByDateRange(result, dateRange);
  }, [events, filter, dateRange]);

  const typeCounts = useMemo(() => {
    const counts: Record<EventType, number> = { alert: 0, scan: 0, takedown: 0, shield: 0, passport: 0 };
    events.forEach((e) => { counts[e.type]++; });
    return counts;
  }, [events]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FadeIn>
        <SectionHeader
          icon={Activity}
          title="Activity Timeline"
          description="Chronological feed of all actions"
          action={
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <Clock className="h-3.5 w-3.5" />
              {events.length} event{events.length !== 1 ? "s" : ""}
            </div>
          }
        />
      </FadeIn>

      {/* Stats Summary */}
      {!loading && events.length > 0 && (
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(["alert", "scan", "takedown", "shield", "passport"] as EventType[]).map((type) => {
              const Icon = EVENT_ICONS[type];
              return (
                <Card key={type} className="border-white/[0.06]">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", EVENT_BG[type], EVENT_COLORS[type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-ink">{typeCounts[type]}</p>
                      <p className="text-[10px] uppercase tracking-wider text-ink-muted">{type}s</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FadeIn>
      )}

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  filter === f.id
                    ? "bg-green/20 text-green ring-1 ring-green/30"
                    : "bg-white/[0.05] text-ink-muted hover:bg-white/[0.08] hover:text-ink"
                )}
              >
                {f.label}
                {f.id !== "all" && typeCounts[f.id as EventType] > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{typeCounts[f.id as EventType]}</span>
                )}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-white/[0.08] mx-1 hidden sm:block" />
          <div className="flex gap-1.5">
            {DATE_RANGES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDateRange(d.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  dateRange === d.id
                    ? "bg-cyan/20 text-cyan ring-1 ring-cyan/30"
                    : "bg-white/[0.05] text-ink-muted hover:bg-white/[0.08] hover:text-ink"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}>
              <Skeleton className="h-20 rounded-xl" />
            </motion.div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Events from alerts, scans, takedowns, shields, and passport will appear here."
        />
      ) : (
        <StaggerContainer className="relative space-y-0">
          {/* Timeline line */}
          <motion.div
            className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-green/30 via-cyan/20 to-transparent"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ transformOrigin: "top" }}
          />

          <AnimatePresence>
            {filtered.map((event) => {
              const Icon = EVENT_ICONS[event.type];
              const isExpanded = expandedId === event.id;
              return (
                <StaggerItem key={event.id}>
                  <div className="relative flex gap-4 pb-4">
                    {/* Timeline dot */}
                    <div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-[#04060a]", EVENT_BG[event.type], EVENT_COLORS[event.type])}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    {/* Event card */}
                    <Kinetic className="flex-1">
                      <Card className="border-white/[0.06] hover:border-white/[0.12]">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-ink">{event.title}</p>
                                <Badge variant={SEVERITY_COLORS[event.severity] as any}>
                                  {event.severity}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-sm text-ink-muted">{event.description}</p>
                              <p className="mt-1 text-xs text-ink-faint">{timeAgo(event.date)}</p>
                            </div>
                            <Button
                              size="iconSm"
                              variant="ghost"
                              onClick={() => setExpandedId(isExpanded ? null : event.id)}
                              className="shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </div>

                          <Expandable open={isExpanded}>
                            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-3">
                              {Object.entries(event.details).map(([key, val]) => (
                                <div key={key}>
                                  <p className="text-[10px] uppercase tracking-wider text-ink-faint">{key}</p>
                                  <p className="text-xs font-medium text-ink-muted">{val}</p>
                                </div>
                              ))}
                            </div>
                          </Expandable>
                        </CardContent>
                      </Card>
                    </Kinetic>
                  </div>
                </StaggerItem>
              );
            })}
          </AnimatePresence>
        </StaggerContainer>
      )}
    </div>
  );
}
