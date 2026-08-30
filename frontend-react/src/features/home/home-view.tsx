import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ShieldX,
  ShieldCheck,
  ScanSearch,
  BellRing,
  AlertTriangle,
  ArrowRight,
  Zap,
  Sparkles,
  Lock,
  X,
  Gift,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api, type UserData } from "@/lib/api";
import { usePsychology } from "@/lib/psychology";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem, Kinetic } from "@/components/ui/motion";
import { confidenceColor, confidenceLabel, cn } from "@/lib/utils";
import {
  StreakWidget,
  ThreatAvoidanceWidget,
  UrgencyCountdown,
  AnchorMetric,
} from "@/components/psychology/motivation";
import { SocialProofFeed } from "@/components/psychology/social-proof";
import { BadgesGrid } from "@/components/psychology/badges";
import { InsightsList, ProtectionTimeline } from "@/components/psychology/insights";
import { getShieldStates } from "@/features/shields/shields-view";

const TOTAL_SHIELDS = 5;
const EDU_KEY = "enclave_plan_edu_dismissed";

export function HomeView() {
  const { setTab, toast } = useApp();
  const { user } = useAuth();
  const psych = usePsychology();
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shieldsActive, setShieldsActive] = useState(0);
  const [eduDismissed, setEduDismissed] = useState(
    () => localStorage.getItem(EDU_KEY) === "1"
  );

  const onFreePlan = (user as any)?.plan === "free" && !eduDismissed;

  useEffect(() => {
    let active = true;
    api
      .getUserData()
      .then((d) => active && setData(d))
      .catch(() => active && setData({ user: user ?? {}, alerts: [] }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const shieldStates = getShieldStates();
    const activeCount = Object.values(shieldStates).filter(Boolean).length;
    setShieldsActive(activeCount);
  }, []);

  const alerts = data?.alerts ?? [];
  const critical = alerts.filter((a) => (a.confidence ?? 0) >= 80).length;
  const elevated = alerts.filter(
    (a) => (a.confidence ?? 0) >= 50 && (a.confidence ?? 0) < 80
  ).length;
  const safe = alerts.filter((a) => (a.confidence ?? 0) < 50).length;

  // Calculate protection score based on active shields and alerts
  const baseScore = Math.round((shieldsActive / TOTAL_SHIELDS) * 100);
  const alertPenalty = Math.min(30, critical * 10 + elevated * 5);
  const protectionScore = Math.max(8, baseScore - alertPenalty);

  const firstName = user?.fullName || "Guardian";

  useEffect(() => {
    const newly = psych.checkBadges(shieldsActive);
    newly.forEach((name) =>
      toast({ title: `🏆 Badge unlocked: ${name}!`, variant: "success" })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length, psych.streak, psych.scans, psych.takedowns]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* ─── HERO ─── */}
      <StaggerContainer className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <StaggerItem>
          <Card className="relative overflow-hidden p-6 md:p-7">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-green/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:gap-7">
              <div className="relative mx-auto shrink-0">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border border-dashed border-green/15"
                />
                <div className="pulse-ring absolute inset-0 rounded-full" />
                <ProgressRing value={protectionScore} size={200} strokeWidth={12} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-4xl font-bold text-ink">
                    {protectionScore}
                  </span>
                  <span className="text-[11px] uppercase tracking-widest text-ink-muted">
                    Protection
                  </span>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <Badge variant="cyan" className="mb-3">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
                  Shield Active
                </Badge>
                <h2 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
                  Good morning, <span className="text-gradient">{firstName}</span>
                </h2>
                <p className="mt-2 text-sm text-ink-muted">
                  Your identity is {protectionScore >= 80 ? "strongly" : "moderately"} guarded.
                  {critical > 0
                    ? ` ${critical} critical threat${critical > 1 ? "s" : ""} needs action.`
                    : " No critical threats right now."}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3 md:justify-start">
                  <Button onClick={() => setTab("scan")}>
                    <ScanSearch className="h-4 w-4" />
                    Run Scan
                  </Button>
                  <Button variant="glass" onClick={() => setTab("alerts")}>
                    View Alerts
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Anchoring strip */}
            <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
              <StreakWidget streak={psych.streak} sub={psych.streakSub} />
              <ThreatAvoidanceWidget count={psych.threatsBlocked} />
            </div>
          </Card>
        </StaggerItem>

        {/* Bento stat stack */}
        <StaggerItem className="grid grid-cols-2 gap-4">
          <StatTile
            icon={ShieldCheck}
            color="green"
            value={loading ? "—" : safe.toString()}
            label="Safe detections"
          />
          <StatTile
            icon={AlertTriangle}
            color="amber"
            value={loading ? "—" : elevated.toString()}
            label="Elevated risk"
          />
          <StatTile
            icon={ShieldX}
            color="red"
            value={loading ? "—" : critical.toString()}
            label="Critical threats"
          />
          <div className="flex flex-col justify-center rounded-2xl glass p-4 md:p-5">
            <AnchorMetric
              icon={ScanSearch}
              color="cyan"
              value={psych.scans}
              label="scans run"
              sub="Deep scan power"
            />
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* ─── FREE-PLAN EDUCATION / CONTEXTUAL UPGRADE ─── */}
      {onFreePlan && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-gradient-to-r from-cyan/[0.07] via-green/[0.03] to-transparent p-5 md:p-6"
        >
          <button
            onClick={() => {
              localStorage.setItem(EDU_KEY, "1");
              setEduDismissed(true);
            }}
            className="absolute right-4 top-4 rounded-lg p-1 text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
              <Lock className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <p className="font-display text-base font-bold text-ink">
                Your identity deserves continuous protection.
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Your Free plan detects threats when you scan. Upgrade for ongoing monitoring,
                automated takedowns, and dark-web scanning — so threats are caught before they spread.
              </p>
            </div>
            <Button
              variant="cyan"
              className="shrink-0"
              onClick={() => window.dispatchEvent(new CustomEvent("enclave:open-plans"))}
            >
              See plans
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* ─── URGENCY BANNER (FOMO + SCARCITY) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <UrgencyCountdown />
      </motion.div>

      {/* ─── BENTO: detections + social proof ─── */}
      <StaggerContainer className="grid gap-5 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-ink">
                  Latest Detections
                </h3>
                <button
                  onClick={() => setTab("alerts")}
                  className="flex items-center gap-1 text-xs text-cyan transition-colors hover:text-green"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-white/15"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: confidenceColor(a.confidence ?? 0) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {a.url || a.image || a.description || "Detection"}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {confidenceLabel(a.confidence ?? 0)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          (a.confidence ?? 0) >= 80
                            ? "red"
                            : (a.confidence ?? 0) >= 50
                            ? "amber"
                            : "green"
                        }
                      >
                        {Math.round(a.confidence ?? 0)}%
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <SocialProofFeed />
        </StaggerItem>
      </StaggerContainer>

      {/* ─── BENTO: insights + badges ─── */}
      <StaggerContainer className="grid gap-5 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber" />
                <h3 className="font-display text-sm font-semibold text-ink">
                  Smart Insights
                </h3>
              </div>
              <InsightsList
                psych={psych}
                shieldsActive={shieldsActive}
                alerts={alerts}
              />
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardContent className="p-5">
              <BadgesGrid unlockedIds={psych.unlockedIds} />
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* ─── BENTO: quick actions + timeline ─── */}
      <StaggerContainer className="grid gap-5 lg:grid-cols-3">
        <StaggerItem>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col p-5">
              <h3 className="mb-4 font-display text-sm font-semibold text-ink">
                Quick Actions
              </h3>
              <div className="flex flex-1 flex-col gap-2.5">
                <QuickAction
                  icon={ScanSearch}
                  color="cyan"
                  label="Deep Scan"
                  sub="Crawl the web for your face"
                  onClick={() => setTab("scan")}
                />
                <QuickAction
                  icon={Sparkles}
                  color="green"
                  label="Protect an Image"
                  sub="Watermark & rights shield"
                  onClick={() => setTab("scan")}
                />
                <QuickAction
                  icon={BellRing}
                  color="purple"
                  label="Configure Notifications"
                  sub="Alert strategy & digest"
                  onClick={() => setTab("settings")}
                />
                <QuickAction
                  icon={Gift}
                  color="green"
                  label="Grow Your Protection"
                  sub="Invite friends & earn rewards"
                  onClick={() => setTab("settings")}
                />
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-5">
              <h3 className="mb-4 font-display text-sm font-semibold text-ink">
                Protection Timeline
              </h3>
              <ProtectionTimeline createdAt={psych.createdAt} alerts={alerts} />
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}

function StatTile({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: typeof ShieldCheck;
  color: "green" | "amber" | "red" | "cyan";
  value: string;
  label: string;
}) {
  const colors: Record<string, string> = {
    green: "bg-green/15 text-green",
    amber: "bg-amber/15 text-amber",
    red: "bg-red/15 text-red",
    cyan: "bg-cyan/15 text-cyan",
  };
  return (
    <Kinetic className="h-full">
      <Card className="h-full">
        <CardContent className="p-4 md:p-5">
          <div
            className={cn(
              "mb-3 flex h-9 w-9 items-center justify-center rounded-lg",
              colors[color]
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <p className="font-display text-2xl font-bold text-ink">{value}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
        </CardContent>
      </Card>
    </Kinetic>
  );
}

function QuickAction({
  icon: Icon,
  color,
  label,
  sub,
  onClick,
}: {
  icon: typeof ScanSearch;
  color: "cyan" | "green" | "purple";
  label: string;
  sub: string;
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    cyan: "bg-cyan/15 text-cyan",
    green: "bg-green/15 text-green",
    purple: "bg-purple/15 text-purple",
  };
  const gradients: Record<string, string> = {
    cyan: "from-cyan/5 to-transparent",
    green: "from-green/5 to-transparent",
    purple: "from-purple/5 to-transparent",
  };
  return (
    <motion.button
      whileHover={{ y: -2, x: 3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      onClick={onClick}
      className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors duration-200 hover:border-green/25 hover:bg-white/[0.05]"
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", gradients[color])} />
      <span
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          colors[color]
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="relative min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block truncate text-xs text-ink-muted">{sub}</span>
      </span>
    </motion.button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <ScanSearch className="h-10 w-10 text-ink-faint" />
      </motion.div>
      <div>
        <p className="text-sm font-medium text-ink">No detections yet</p>
        <p className="text-xs text-ink-muted">
          Run your first scan to start protecting your identity
        </p>
      </div>
    </div>
  );
}
