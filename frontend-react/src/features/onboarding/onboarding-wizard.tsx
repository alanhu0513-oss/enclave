import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Camera,
  ScanSearch,
  Compass,
  Check,
  ChevronRight,
  ChevronLeft,
  Shield,
  X,
  ShieldCheck,
  BellRing,
  FileBarChart,
  Settings,
  Loader2,
  Upload,
  ImageIcon,
  Sparkles,
  Zap,
  Eye,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ONBOARD_KEY = "enclave_onboarding_completed";
const ONBOARD_TIME_KEY = "enclave_onboarding_completed_at";
const PROGRESS_DISMISS_KEY = "enclave_progress_tracker_dismissed";

export function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return false;
  }
}

export function completeOnboarding() {
  try {
    localStorage.setItem(ONBOARD_KEY, "1");
    localStorage.setItem(ONBOARD_TIME_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
}

function getOnboardingAge(): number | null {
  try {
    const ts = localStorage.getItem(ONBOARD_TIME_KEY);
    if (!ts) return null;
    return Date.now() - Number(ts);
  } catch {
    return null;
  }
}

interface Step {
  id: string;
  title: string;
  sub: string;
  icon: typeof Camera;
}

const STEPS: Step[] = [
  {
    id: "enroll",
    title: "Enroll your face",
    sub: "Upload a clear selfie so ENCLAVE can match your identity across the web.",
    icon: Camera,
  },
  {
    id: "scan",
    title: "Run your first scan",
    sub: "Scan a URL to see deepfake & identity threats detected in seconds.",
    icon: ScanSearch,
  },
  {
    id: "tour",
    title: "Meet your vault",
    sub: "A quick tour of what each tab protects — plus how to level up.",
    icon: Compass,
  },
];

const TOUR = [
  { icon: Shield, label: "Shields", desc: "Toggle on permanent protections that run in the background.", gradient: "from-green/20 to-green/5", iconColor: "text-green" },
  { icon: ScanSearch, label: "Scan", desc: "Deep-scan URLs, images, or the open web for your face.", gradient: "from-cyan/20 to-cyan/5", iconColor: "text-cyan" },
  { icon: BellRing, label: "Alerts", desc: "Every detection, ranked by risk, with one-click takedown.", gradient: "from-amber/20 to-amber/5", iconColor: "text-amber" },
  { icon: FileBarChart, label: "Reports", desc: "Scheduled PDF reports documenting your exposure.", gradient: "from-purple/20 to-purple/5", iconColor: "text-purple" },
  { icon: Settings, label: "Settings", desc: "Plans, family, referral rewards, and account security.", gradient: "from-rose/20 to-rose/5", iconColor: "text-rose" },
];

const WELCOME_FEATURES = [
  { icon: Eye, label: "Deepfake Detection", desc: "AI-powered analysis spots face swaps and voice clones." },
  { icon: ShieldCheck, label: "Identity Monitoring", desc: "Continuous scans across the web for your likeness." },
  { icon: Trash2, label: "Instant Takedowns", desc: "One-click removal requests to platforms." },
];

export function WelcomeModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-[91] flex items-center justify-center bg-[#04060a]/95 p-4 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-2xl backdrop-blur-xl"
      >
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-green/20 blur-[100px]" />

        <div className="relative flex flex-col items-center px-8 pt-12 pb-8 text-center">
          {/* Shield icon with glow */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-6"
          >
            <div className="absolute inset-0 rounded-full bg-green/30 blur-xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-green/30 bg-gradient-to-br from-green/20 to-green/5 shadow-lg shadow-green/10">
              <Shield className="h-10 w-10 text-green" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="font-display text-3xl font-bold tracking-tight"
          >
            <span className="bg-gradient-to-r from-green via-cyan to-green bg-clip-text text-transparent">
              Welcome to ENCLAVE
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="mt-3 text-sm text-ink-muted"
          >
            Your identity, protected by AI
          </motion.p>

          {/* Feature bullets */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mt-8 w-full space-y-3"
          >
            {WELCOME_FEATURES.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.35 }}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green/10 text-green">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <div className="text-left">
                  <p className="text-sm font-medium text-ink">{f.label}</p>
                  <p className="text-xs text-ink-muted">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.4 }}
            className="mt-8 flex w-full flex-col gap-3"
          >
            <Button onClick={onStart} className="h-12 w-full text-sm font-semibold">
              <Zap className="mr-1.5 h-4 w-4" />
              Get Started
            </Button>
            <button
              onClick={onSkip}
              className="text-xs text-ink-muted transition-colors hover:text-ink"
            >
              Explore on my own
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export function OnboardingWizard() {
  const { toast, setTab } = useApp();
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [faceDone, setFaceDone] = useState(false);
  const [tiers, setTiers] = useState<any[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const plan = (user as any)?.plan || "free";

  useEffect(() => {
    let active = true;
    api
      .getTiers()
      .then((res: any) => {
        const list = (res?.tiers ? Object.values(res.tiers) : []).filter(Boolean);
        if (active && list.length) setTiers(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function handleUpgrade(tierId: string) {
    if (upgrading) return;
    setUpgrading(tierId);
    try {
      const success = window.location.origin + "/billing/success";
      const cancel = window.location.origin + "/billing/cancel";
      const session: any = await api.startCheckout(tierId, success, cancel);
      track("checkout_started", { tier: tierId });
      if (session?.url) {
        window.location.href = session.url;
      } else {
        toast({ title: "Checkout available", body: "Redirecting shortly…", variant: "success" });
        completeOnboarding();
        setDone(true);
      }
    } catch (e: any) {
      toast({ title: "Upgrade failed", body: e.message, variant: "error" });
    } finally {
      setUpgrading(null);
    }
  }

  async function handleFace(file: File) {
    setBusy(true);
    try {
      const res: any = await api.uploadFace(file);
      setFaceDone(true);
      toast({
        title: "Face enrolled",
        body: "Your identity profile is ready.",
        variant: "success",
      });
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      void res;
    } catch (e: any) {
      toast({ title: "Enrollment failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function runScan() {
    if (!url) {
      toast({ title: "Enter a URL first", variant: "info" });
      return;
    }
    setBusy(true);
    setScanError(null);
    try {
      const data: any = await api.scanUrl(url);
      setScanResult(data?.alert ?? data);
      toast({ title: "Scan complete", body: "First detection ready.", variant: "success" });
      track("first_scan");
    } catch (e: any) {
      setScanError(e.message || "Scan failed");
      toast({ title: "Scan failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      completeOnboarding();
      track("onboarding_complete");
      setDone(true);
    }
  }

  function skip() {
    completeOnboarding();
    track("onboarding_skip");
    setDone(true);
  }

  function handleWelcomeSkip() {
    completeOnboarding();
    track("onboarding_skip");
    setDone(true);
  }

  useEffect(() => {
    if (!done) return;
    setTab("home");
  }, [done, setTab]);

  if (done) return null;

  const current = STEPS[stepIdx];
  const StepIcon = current.icon;

  return (
    <AnimatePresence mode="wait">
      {showWelcome ? (
        <WelcomeModal
          key="welcome"
          onStart={() => setShowWelcome(false)}
          onSkip={handleWelcomeSkip}
        />
      ) : (
        <motion.div
          key="wizard"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#04060a]/95 p-4 backdrop-blur-xl"
        >
      <div className="relative flex min-h-[520px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 glass-strong shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green" />
            <span className="font-display text-sm font-bold tracking-tight text-ink">
              Welcome to ENCLAVE
            </span>
          </div>
          <button
            onClick={skip}
            className="flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
            Skip
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-2 px-6 pt-5">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i < stepIdx ? "bg-green" : i === stepIdx ? "bg-cyan" : "bg-white/10"
                )}
              />
              <span
                className={cn(
                  "mt-1.5 block text-[10px] uppercase tracking-wider",
                  i <= stepIdx ? "text-ink" : "text-ink-faint"
                )}
              >
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIdx}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-5 flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green/15 text-green">
                  <StepIcon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                    {current.title}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">{current.sub}</p>
                </div>
              </div>

              {stepIdx === 0 && <EnrollStep busy={busy} preview={preview} faceDone={faceDone} onFile={handleFace} />}
              {stepIdx === 1 && (
                <ScanStep
                  busy={busy}
                  url={url}
                  setUrl={setUrl}
                  onScan={runScan}
                  result={scanResult}
                  error={scanError}
                />
              )}
              {stepIdx === 2 && (
                <TourStep
                  plan={plan}
                  tiers={tiers}
                  upgrading={upgrading}
                  onUpgrade={handleUpgrade}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between border-t border-white/[0.07] px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          {stepIdx < 2 ? (
            <Button onClick={goNext} disabled={stepIdx === 0 && !faceDone}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={goNext}>
              Done
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EnrollStep({
  busy,
  preview,
  faceDone,
  onFile,
}: {
  busy: boolean;
  preview: string | null;
  faceDone: boolean;
  onFile: (f: File) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <label
        className={cn(
          "relative flex h-44 w-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
          faceDone ? "border-green/50" : "border-white/15 hover:border-green/40"
        )}
      >
        {preview ? (
          <img src={preview} alt="Selfie preview" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-ink-muted">
            <Upload className="h-8 w-8" />
            <span className="text-xs">Click to upload a selfie</span>
          </span>
        )}
        {faceDone && (
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-green text-black">
            <Check className="h-4 w-4" />
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      {busy && (
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin text-cyan" />
          Analyzing your face…
        </span>
      )}
      {!faceDone && (
        <p className="max-w-sm text-center text-xs text-ink-muted">
          Your face is hashed locally and never shared. This powers identity matching across scans.
        </p>
      )}
      {faceDone && (
        <Badge variant="green" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Identity enrolled
        </Badge>
      )}
    </div>
  );
}

function ScanStep({
  busy,
  url,
  setUrl,
  onScan,
  result,
  error,
}: {
  busy: boolean;
  url: string;
  setUrl: (u: string) => void;
  onScan: () => void;
  result: any;
  error: string | null;
}) {
  const confidence = result?.confidence ?? result?.riskScore;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onScan()}
          placeholder="https://example.com"
          className="h-11 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-green/40"
        />
        <Button onClick={onScan} disabled={busy} className="h-11 shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          Scan
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <ImageIcon className="h-3.5 w-3.5" />
        Deepfake detection + web match run instantly. You can also scan an image later from the Scan tab.
      </p>
      {error && (
        <p className="rounded-lg border border-red/20 bg-red/10 px-3 py-2 text-xs text-red">{error}</p>
      )}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: confidence === undefined ? "#22c55e" : (confidence ?? 0) >= 80 ? "#ef4444" : (confidence ?? 0) >= 50 ? "#f59e0b" : "#22c55e" }}
            />
            <div>
              <p className="text-sm font-medium text-ink">
                {result.url || result.image || result.description || "Detection recorded"}
              </p>
              <p className="text-xs text-ink-muted">
                {confidence === undefined ? "No deepfake signal" : `${Math.round(confidence)}% risk confidence`}
              </p>
            </div>
          </div>
          <Badge variant="green" className="gap-1">
            <Check className="h-3.5 w-3.5" />
            Scanned
          </Badge>
        </motion.div>
      )}
    </div>
  );
}

function TourStep({
  plan,
  tiers,
  upgrading,
  onUpgrade,
}: {
  plan: string;
  tiers: any[];
  upgrading: string | null;
  onUpgrade: (id: string) => void;
}) {
  const onFree = plan === "free";
  const paid = tiers.filter((t) => t.id !== "free" && (t.id as string) !== "detection_only");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {TOUR.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.01, y: -2 }}
            className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            <div className={cn("absolute inset-0 bg-gradient-to-r opacity-0 transition-opacity group-hover:opacity-100", t.gradient)} />
            <span className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]", t.iconColor)}>
              <t.icon className="h-4 w-4" />
            </span>
            <div className="relative min-w-0">
              <p className="text-sm font-medium text-ink">{t.label}</p>
              <p className="text-xs text-ink-muted">{t.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {onFree && (
        <div className="rounded-xl border border-cyan/25 bg-cyan/[0.05] p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">You're on the Free plan</p>
              <p className="mt-1 text-xs text-ink-muted">
                Upgrade for continuous monitoring, more scans per month, and automated takedowns —
                keeping your identity protected around the clock.
              </p>
            </div>
          </div>

          {paid.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {paid.map((p) => {
                const price = ((p.price ?? 0) / 100).toLocaleString("en-US", {
                  minimumFractionDigits: (p.price ?? 0) % 100 === 0 ? 0 : 2,
                });
                return (
                  <div
                    key={p.id}
                    className="flex flex-col rounded-xl border border-white/10 bg-surface-1/60 p-3"
                  >
                    <p className="text-sm font-semibold text-ink">{p.name}</p>
                    <p className="mt-1 font-display text-xl font-bold text-ink">
                      ${price}
                      <span className="text-xs font-normal text-ink-muted">/mo</span>
                    </p>
                    <p className="mt-1 line-clamp-2 flex-1 text-xs text-ink-muted">
                      {(p.features?.[0] ?? "")}
                    </p>
                    <Button
                      variant="cyan"
                      size="sm"
                      className="mt-3"
                      disabled={upgrading !== null}
                      onClick={() => onUpgrade(p.id)}
                    >
                      {upgrading === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Upgrade"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="cyan"
                size="sm"
                disabled={upgrading !== null}
                onClick={() => onUpgrade("pro")}
              >
                {upgrading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "See plans"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PROGRESS_ITEMS = [
  { key: "profile", label: "Profile", icon: Camera },
  { key: "scan", label: "First Scan", icon: ScanSearch },
  { key: "shields", label: "Shields Active", icon: Shield, max: 5 },
];

export function ProgressTracker() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const visible = useCallback(() => {
    try {
      if (localStorage.getItem(PROGRESS_DISMISS_KEY) === "1") return false;
      const age = getOnboardingAge();
      if (age === null) return false;
      return age < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }, []);

  const [show, setShow] = useState(visible);

  useEffect(() => {
    setShow(visible());
  }, [visible]);

  if (!show || dismissed) return null;

  const faceEnrolled = !!(user as any)?.faceEnrolled;
  const scansDone = Math.min(((user as any)?.scansCount ?? 0), 1);
  const shieldsActive = Math.min(((user as any)?.shieldsActive ?? 0), 5);

  const items = [
    { ...PROGRESS_ITEMS[0], done: faceEnrolled, count: faceEnrolled ? 1 : 0 },
    { ...PROGRESS_ITEMS[1], done: scansDone > 0, count: scansDone },
    { ...PROGRESS_ITEMS[2], count: shieldsActive, done: shieldsActive >= 5 },
  ];

  const allDone = items.every((it) => it.done);

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => {
        setDismissed(true);
        try { localStorage.setItem(PROGRESS_DISMISS_KEY, "1"); } catch {}
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(PROGRESS_DISMISS_KEY, "1"); } catch {}
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.92 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 right-6 z-[80] w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0e16]/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Progress</span>
          <button onClick={dismiss} className="text-ink-faint transition-colors hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-1 p-3">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", it.done ? "bg-green/15 text-green" : "bg-white/[0.05] text-ink-muted")}>
                {it.done ? <Check className="h-3.5 w-3.5" /> : <it.icon className="h-3.5 w-3.5" />}
              </span>
              <span className={cn("text-sm", it.done ? "text-ink" : "text-ink-muted")}>
                {it.label}
                {"max" in it && it.max ? ` (${it.count}/${it.max})` : ""}
              </span>
            </div>
          ))}
        </div>
        {allDone && (
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <p className="text-center text-xs font-medium text-green">All set! You're protected.</p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
