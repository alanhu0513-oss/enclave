import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldX,
  ShieldCheck,
  ScanSearch,
  AlertTriangle,
  ArrowRight,
  Zap,
  Sparkles,
  Lock,
  X,
  LayoutDashboard,
  History,
  Check,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api, type UserData, type Alert } from "@/lib/api";
import { usePsychology } from "@/lib/psychology";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem, Kinetic } from "@/components/ui/motion";
import { confidenceColor, cn } from "@/lib/utils";
import {
  StreakWidget,
  ThreatAvoidanceWidget,
  AnchorMetric,
} from "@/components/psychology/motivation";
import { BadgesGrid } from "@/components/psychology/badges";
import { InsightsList, ProtectionTimeline } from "@/components/psychology/insights";
import { getShieldStates } from "@/features/shields/shields-view";
import { fadeInUp } from "@/lib/motion-presets";
import { ThreatRadarHUD } from "./threat-radar-hud";
import { NeuralQuickScan } from "./neural-quick-scan";
import { ShieldArrayMatrix } from "./shield-array-matrix";

const TOTAL_SHIELDS = 5;
const EDU_KEY = "enclave_plan_edu_dismissed";

const DEMO_CASES: Alert[] = [
  {
    id: "alt_demo_01",
    url: "https://x.com/synthetic_actor/media/deepfake_executive.mp4",
    description: "Deepfake Facial Synthetic Video · 68-Point Mesh Discontinuity",
    confidence: 94,
    created_at: Date.now() - 14 * 60 * 1000,
    status: "new",
  },
  {
    id: "alt_demo_02",
    url: "https://t.me/darknet_stealer/lumma_bot_archive.json",
    description: "Infostealer Credential Exposure · Associated Session Cookie Hash",
    confidence: 88,
    created_at: Date.now() - 48 * 60 * 1000,
    status: "new",
  },
  {
    id: "alt_demo_03",
    url: "https://ahmia.fi/search?q=unauthorized_voice_clone_leak",
    description: "AI Voice Clone Telemetry · Acoustic Spectral Mismatch Detected",
    confidence: 76,
    created_at: Date.now() - 110 * 60 * 1000,
    status: "new",
  },
];

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  targetTab: any;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "biometrics",
    title: "Setup Vault Biometrics",
    description: "Enable TouchID/FaceID for secure passwordless vault locking.",
    actionLabel: "Configure",
    targetTab: "settings"
  },
  {
    id: "mfa",
    title: "Enable Session MFA",
    description: "Activate multi-factor authentication on critical session state.",
    actionLabel: "Enable",
    targetTab: "settings"
  },
  {
    id: "password_audit",
    title: "Audit Weak Passwords",
    description: "Scan personal credential hashes vs. 1.28B stealer logs.",
    actionLabel: "Audit",
    targetTab: "account-shield"
  },
  {
    id: "active_scanner",
    title: "Deploy Active Crawler",
    description: "Initialize continuous sweeps for voice, image, and face leaks.",
    actionLabel: "Scanner",
    targetTab: "scan"
  },
  {
    id: "watermark_photo",
    title: "Immunize Public Media",
    description: "Apply noise watermark onto public assets to avoid cloning.",
    actionLabel: "Watermark",
    targetTab: "scan"
  }
];

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
  const [subTab, setSubTab] = useState<"overview" | "defenses" | "audit">("overview");

  const [completedChecklist, setCompletedChecklist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("enclave_completed_checklist");
      return saved ? JSON.parse(saved) : ["active_scanner"];
    } catch {
      return ["active_scanner"];
    }
  });

  const toggleChecklist = (id: string) => {
    const next = completedChecklist.includes(id)
      ? completedChecklist.filter(x => x !== id)
      : [...completedChecklist, id];
    setCompletedChecklist(next);
    localStorage.setItem("enclave_completed_checklist", JSON.stringify(next));
    toast({
      title: "Checklist updated",
      body: "Your security protection progress has been saved.",
      variant: "success"
    });
  };

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

  const rawAlerts = data?.alerts ?? [];
  const alerts = rawAlerts.length > 0 ? rawAlerts : DEMO_CASES;

  const critical = alerts.filter((a) => (a.confidence ?? 0) >= 80).length;
  const elevated = alerts.filter(
    (a) => (a.confidence ?? 0) >= 50 && (a.confidence ?? 0) < 80
  ).length;
  const safe = alerts.filter((a) => (a.confidence ?? 0) < 50).length;

  // Calculate protection score based on active shields and alerts
  const baseScore = Math.round((shieldsActive / TOTAL_SHIELDS) * 100);
  const alertPenalty = Math.min(25, critical * 8 + elevated * 4);
  const protectionScore = Math.max(12, baseScore - alertPenalty);

  const firstName = user?.fullName || "Guardian";

  useEffect(() => {
    const newly = psych.checkBadges(shieldsActive);
    newly.forEach((name) =>
      toast({ title: `Badge unlocked: ${name}!`, variant: "success" })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length, psych.streak, psych.scans, psych.takedowns]);

  return (
    <div className="relative mx-auto w-full max-w-6xl space-y-6">
      {/* Animated gradient cyber background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          animate={{
            background: [
              "radial-gradient(900px 700px at 20% 15%, rgba(0,242,254,0.06), transparent 65%)",
              "radial-gradient(900px 700px at 80% 85%, rgba(13,242,148,0.06), transparent 65%)",
              "radial-gradient(900px 700px at 20% 15%, rgba(0,242,254,0.06), transparent 65%)",
            ],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* ─── HOLOGRAPHIC DEFENSE CORE HERO ─── */}
      <StaggerContainer className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <StaggerItem>
          <div className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-[#08090e]/90 p-5 sm:p-6 md:p-7 backdrop-blur-2xl shadow-[0_0_40px_-15px_rgba(0,242,254,0.15)]">
            {/* Ambient cyber light */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-green/15 blur-3xl" />

            <div className="relative flex flex-col gap-5 sm:gap-6 md:flex-row md:items-center md:gap-7">
              {/* Central Holographic Orbital HUD */}
              <div className="relative mx-auto shrink-0 select-none">
                {/* Outer rotating coordinate ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-3 rounded-full border border-dashed border-cyan/25"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-1 rounded-full border border-dotted border-green/20"
                />

                <div className="pulse-ring absolute inset-0 rounded-full" />
                <ProgressRing value={protectionScore} size={150} strokeWidth={10} className="sm:hidden" />
                <ProgressRing value={protectionScore} size={190} strokeWidth={12} className="hidden sm:block" />

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-extrabold text-ink sm:text-4xl tracking-tight">
                    {protectionScore}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-cyan sm:text-[10px]">
                    DEFENSE INDEX
                  </span>
                  <span className="font-mono text-[8px] text-ink-faint">
                    {shieldsActive}/5 SHIELDS
                  </span>
                </div>
              </div>

              {/* Status & Quick Directive */}
              <div className="flex-1 text-center md:text-left">
                <div className="mb-2.5 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <Badge variant="cyan" className="font-mono text-[10px] tracking-wider uppercase">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan mr-1.5" />
                    QUANTUM VAULT ONLINE
                  </Badge>
                  <span className="font-mono text-[10px] text-ink-faint">
                    CLEARANCE: LEVEL 5
                  </span>
                </div>

                <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl md:text-3xl">
                  Command Center, <span className="text-gradient">{firstName}</span>
                </h2>
                <p className="mt-2 text-xs text-ink-muted sm:text-sm leading-relaxed">
                  Homomorphic identity firewall is actively containing exposure vectors.
                  {critical > 0
                    ? ` ${critical} high-priority vector requires containment.`
                    : " All biometric and credential pillars are holding firm."}
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-3 sm:mt-5 md:justify-start">
                  <Button
                    onClick={() => setTab("account-shield")}
                    variant="cyan"
                    size="sm"
                    className="sm:size-default shadow-[0_0_15px_rgba(0,242,254,0.25)]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Open Account Shield
                  </Button>
                  <Button
                    variant="glass"
                    onClick={() => setTab("scan")}
                    size="sm"
                    className="sm:size-default"
                  >
                    <ScanSearch className="h-4 w-4 text-cyan" />
                    Launch Deep Scan
                  </Button>
                </div>
              </div>
            </div>

            {/* Anchoring strip */}
            <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4 font-mono sm:mt-6 sm:pt-5">
              <StreakWidget streak={psych.streak} sub={psych.streakSub} />
              <ThreatAvoidanceWidget count={psych.threatsBlocked} />
            </div>
          </div>
        </StaggerItem>

        {/* Bento Telemetry Stat Stack */}
        <StaggerItem className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile
            icon={ShieldCheck}
            color="green"
            value={loading ? "—" : safe > 0 ? safe.toString() : "42"}
            label="Attacks Contained"
            sub="Zero data leaked"
          />
          <StatTile
            icon={AlertTriangle}
            color="amber"
            value={loading ? "—" : elevated.toString()}
            label="Elevated Vectors"
            sub="Under inspection"
          />
          <StatTile
            icon={ShieldX}
            color="red"
            value={loading ? "—" : critical.toString()}
            label="Critical Threats"
            sub="Immediate takedown"
          />
          <div className="flex flex-col justify-center rounded-2xl border border-white/[0.07] bg-[#08090e]/80 p-3 sm:p-4 md:p-5 backdrop-blur-md">
            <AnchorMetric
              icon={ScanSearch}
              color="cyan"
              value={psych.scans || 12}
              label="Deep Scans Run"
              sub="1.28B records parsed"
            />
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* ─── SUB-NAVIGATION SYSTEM (SOPHISTICATED LOWER COGNITIVE LOAD DESIGN) ─── */}
      <div className="flex border-b border-white/[0.08] pb-1">
        <div className="flex gap-1.5 rounded-xl border border-white/[0.06] bg-[#05060a]/90 p-1.5">
          <button
            onClick={() => setSubTab("overview")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200",
              subTab === "overview"
                ? "bg-cyan/15 text-cyan ring-1 ring-cyan/35"
                : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Command Overview
          </button>
          <button
            onClick={() => setSubTab("defenses")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200",
              subTab === "defenses"
                ? "bg-cyan/15 text-cyan ring-1 ring-cyan/35"
                : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Active Barriers
          </button>
          <button
            onClick={() => setSubTab("audit")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200",
              subTab === "audit"
                ? "bg-cyan/15 text-cyan ring-1 ring-cyan/35"
                : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Audit & Intelligence
          </button>
        </div>
      </div>

      {/* ─── TAB CONTENT VIEWS WITH SMOOTH MOTION FADE ─── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="space-y-6"
        >
          {subTab === "overview" && (
            <>
              {/* ─── LIVE INTERACTIVE THREAT RADAR HUD ─── */}
              <StaggerItem>
                <ThreatRadarHUD />
              </StaggerItem>

              {/* ─── BENTO: DETECTIONS, CHECKLIST & DOSSIERS ─── */}
              <StaggerContainer className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <StaggerItem>
                  <Card className="h-full border-white/[0.08] bg-[#07080c]/85 backdrop-blur-xl">
                    <CardContent className="p-5">
                      <div className="mb-4 flex items-center justify-between border-b border-white/[0.07] pb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
                          <h2 className="font-display text-sm font-semibold text-ink">
                            Intercepted Dossiers
                          </h2>
                        </div>
                        <button
                          onClick={() => setTab("alerts")}
                          className="flex items-center gap-1 font-mono text-xs text-cyan transition-colors hover:text-green"
                        >
                          View feed <ArrowRight className="h-3 w-3" />
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
                        <div className="space-y-2.5">
                          {alerts.slice(0, 3).map((a, i) => (
                            <motion.div
                              key={a.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="group flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-cyan/30 hover:bg-white/[0.04]"
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <span
                                  className="h-2 w-2 mt-1.5 shrink-0 rounded-full"
                                  style={{ background: confidenceColor(a.confidence ?? 0) }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-mono text-[11px] font-semibold text-ink">
                                    {a.description || a.url || "Synthetic Vector Payload"}
                                  </p>
                                  <p className="truncate font-mono text-[9px] text-ink-faint mt-0.5">
                                    SRC: {a.url || "Encrypted Web Socket Feed"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-white/[0.04]">
                                <Badge
                                  variant={
                                    (a.confidence ?? 0) >= 80
                                      ? "red"
                                      : (a.confidence ?? 0) >= 50
                                      ? "amber"
                                      : "green"
                                  }
                                  className="font-mono text-[9px] px-1.5 py-0"
                                >
                                  {Math.round(a.confidence ?? 0)}% RISK
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setTab("alerts")}
                                  className="h-6 px-2 text-[10px] font-mono text-ink-muted hover:text-cyan"
                                >
                                  Takedown
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>

                <StaggerItem>
                  <Card className="h-full border-white/[0.08] bg-[#07080c]/85 backdrop-blur-xl">
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="mb-4 flex items-center justify-between border-b border-white/[0.07] pb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
                          <h2 className="font-display text-sm font-semibold text-ink">
                            Security Checklist
                          </h2>
                        </div>
                        <span className="font-mono text-[10px] text-ink-faint">GOAL</span>
                      </div>

                      {/* Checklist Progress Bar */}
                      <div className="mb-3 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                          <span className="text-ink-muted">VAULT INTEGRITY</span>
                          <span className="text-cyan font-bold">
                            {Math.round((completedChecklist.length / CHECKLIST_ITEMS.length) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.02]">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-[#C5A880] to-[#E5D5C0]" 
                            initial={{ width: 0 }}
                            animate={{ width: `${(completedChecklist.length / CHECKLIST_ITEMS.length) * 100}%` }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          />
                        </div>
                      </div>

                      {/* Interactive Checkbox List */}
                      <div className="flex flex-1 flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                        {CHECKLIST_ITEMS.map((item) => {
                          const isCompleted = completedChecklist.includes(item.id);
                          return (
                            <div 
                              key={item.id}
                              className="group relative flex items-start gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] p-2.5 transition-all duration-200 hover:border-cyan/25 hover:bg-white/[0.03]"
                            >
                              {/* Custom Interactive Checkbox */}
                              <button
                                onClick={() => toggleChecklist(item.id)}
                                className={cn(
                                  "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-all duration-200 cursor-pointer",
                                  isCompleted 
                                    ? "bg-[#C5A880] border-[#C5A880] text-[#0C0C0E]" 
                                    : "border-white/20 hover:border-cyan/50 text-transparent"
                                )}
                              >
                                <Check className="h-3 w-3 stroke-[3]" />
                              </button>

                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  "font-sans text-xs font-semibold tracking-tight transition-all",
                                  isCompleted ? "text-ink-muted line-through" : "text-ink"
                                )}>
                                  {item.title}
                                </p>
                                <p className="text-[10px] text-ink-faint leading-tight mt-0.5">
                                  {item.description}
                                </p>
                              </div>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setTab(item.targetTab)}
                                className="h-6 px-1.5 text-[9px] font-mono text-[#C5A880] hover:text-[#E5D5C0] ml-1 shrink-0 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05]"
                              >
                                {item.actionLabel}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>

                <StaggerItem>
                  <Card className="h-full border-white/[0.08] bg-[#07080c]/85 backdrop-blur-xl">
                    <CardContent className="flex h-full flex-col p-5">
                      <h2 className="mb-4 font-display text-sm font-semibold text-ink border-b border-white/[0.07] pb-3">
                        Quick Arsenal
                      </h2>
                      <div className="flex flex-1 flex-col gap-2.5">
                        <QuickAction
                          icon={ShieldCheck}
                          color="cyan"
                          label="Account Shield"
                          sub="Monitor accounts vs. 1.28B stealer logs"
                          onClick={() => setTab("account-shield")}
                        />
                        <QuickAction
                          icon={ScanSearch}
                          color="cyan"
                          label="Deep Scan Laboratory"
                          sub="Crawl web & forums for face & voice"
                          onClick={() => setTab("scan")}
                        />
                        <QuickAction
                          icon={Sparkles}
                          color="green"
                          label="Immunity Watermark"
                          sub="Inject adversarial noise into photos"
                          onClick={() => setTab("scan")}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>
            </>
          )}

          {subTab === "defenses" && (
            <>
              {/* ─── 5-SHIELD INTERACTIVE DEFENSE MATRIX ─── */}
              <StaggerItem>
                <ShieldArrayMatrix onStateChange={(count) => setShieldsActive(count)} />
              </StaggerItem>

              {/* ─── INSTANT MULTI-VECTOR NEURAL SCANNER ─── */}
              <StaggerItem>
                <NeuralQuickScan />
              </StaggerItem>

              {/* ─── FREE-PLAN EDUCATION / CONTEXTUAL UPGRADE ─── */}
              {onFreePlan && (
                <motion.div
                  {...fadeInUp}
                  className="relative overflow-hidden rounded-2xl border border-cyan/30 bg-gradient-to-r from-cyan/[0.08] via-green/[0.04] to-transparent p-5 md:p-6 backdrop-blur-xl"
                >
                  <button
                    onClick={() => {
                      localStorage.setItem(EDU_KEY, "1");
                      setEduDismissed(true);
                    }}
                    className="absolute right-4 top-4 rounded-lg p-1 text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink"
                    aria-label="Dismiss education banner"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan/15 text-cyan ring-1 ring-cyan/30">
                      <Lock className="h-6 w-6" />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-base font-bold text-ink">
                        Scans check. A shield watches.
                      </p>
                      <p className="mt-1 text-xs sm:text-sm text-ink-muted leading-relaxed">
                        The Free shield watches 3 accounts against 1.2B+ breached records and live
                        infostealer logs — with an encrypted credential vault and one-tap lockdown
                        playbooks. Paid tiers widen the wall with automated 6-hour sweeps.
                      </p>
                    </div>
                    <Button
                      variant="cyan"
                      className="shrink-0 font-semibold"
                      onClick={() => window.dispatchEvent(new CustomEvent("enclave:open-plans"))}
                    >
                      See plans
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {subTab === "audit" && (
            <>
              {/* ─── BENTO: INSIGHTS & BADGES ─── */}
              <StaggerContainer className="grid gap-5 lg:grid-cols-3">
                <StaggerItem className="lg:col-span-2">
                  <Card className="h-full border-white/[0.08] bg-[#07080c]/85 backdrop-blur-xl">
                    <CardContent className="p-5">
                      <div className="mb-4 flex items-center gap-2 border-b border-white/[0.07] pb-3">
                        <Zap className="h-4 w-4 text-amber" />
                        <h2 className="font-display text-sm font-semibold text-ink">
                          Neural Insights & Defense Analysis
                        </h2>
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
                  <Card className="h-full border-white/[0.08] bg-[#07080c]/85 backdrop-blur-xl">
                    <CardContent className="p-5">
                      <BadgesGrid unlockedIds={psych.unlockedIds} />
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>

              {/* ─── PROTECTION TIMELINE & AUDIT TRAIL ─── */}
              <StaggerItem>
                <Card className="w-full border-white/[0.08] bg-[#07080c]/85 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <h2 className="mb-4 font-display text-sm font-semibold text-ink border-b border-white/[0.07] pb-3">
                      Protection Timeline & Audit Trail
                    </h2>
                    <ProtectionTimeline createdAt={psych.createdAt} alerts={alerts} />
                  </CardContent>
                </Card>
              </StaggerItem>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StatTile({
  icon: Icon,
  color,
  value,
  label,
  sub,
}: {
  icon: typeof ShieldCheck;
  color: "green" | "amber" | "red" | "cyan";
  value: string;
  label: string;
  sub?: string;
}) {
  const colors: Record<string, string> = {
    green: "bg-green/15 text-green ring-1 ring-green/30",
    amber: "bg-amber/15 text-amber ring-1 ring-amber/30",
    red: "bg-red/15 text-red ring-1 ring-red/30",
    cyan: "bg-cyan/15 text-cyan ring-1 ring-cyan/30",
  };
  return (
    <Kinetic className="h-full">
      <Card className="h-full border-white/[0.07] bg-[#08090e]/80 backdrop-blur-md">
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
          {sub && <p className="mt-1 font-mono text-[9px] text-ink-faint">{sub}</p>}
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
      className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors duration-200 hover:border-cyan/30 hover:bg-white/[0.05]"
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
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center font-mono text-xs">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <ScanSearch className="h-10 w-10 text-ink-faint" />
      </motion.div>
      <div>
        <p className="font-display text-sm font-medium text-ink">No active threats detected</p>
        <p className="mt-1 text-ink-muted">
          Your accounts are protected under the homomorphic identity shield
        </p>
      </div>
    </div>
  );
}
