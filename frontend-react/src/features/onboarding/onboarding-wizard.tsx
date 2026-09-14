import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Shield,
  X,
  ShieldCheck,
  Check,
  Loader2,
  ScanSearch,
  Globe,
  Gamepad2,
  Landmark,
  CreditCard,
  Mail,
  Wallet,
  Briefcase,
  Users,
  ArrowRight,
  Plus,
  KeyRound,
  Network,
  Gauge,
  Quote,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
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

const QUICK_SITES = [
  { id: "google", name: "Google", icon: Globe, color: "text-cyan" },
  { id: "steam", name: "Steam", icon: Gamepad2, color: "text-blue" },
  { id: "bank", name: "Bank", icon: Landmark, color: "text-purple" },
  { id: "credit-card", name: "Credit card", icon: CreditCard, color: "text-amber" },
  { id: "instagram", name: "Instagram", icon: Mail, color: "text-pink" },
  { id: "facebook", name: "Facebook", icon: Users, color: "text-blue" },
  { id: "paypal", name: "PayPal", icon: Wallet, color: "text-green" },
  { id: "work", name: "Work", icon: Briefcase, color: "text-orange" },
];

type OnStep = 0 | 1 | 2 | 3;

/** Step 1 — Outcome: immediate breach scan result (the "aha moment"). */
function StepBreachResult({ loading, breaches, accounts, onNext, onSkip }: {
  loading: boolean;
  breaches: number;
  accounts: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const clean = breaches === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-1 flex-col items-center px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 14 }}
        className={cn(
          "relative mb-6 flex h-24 w-24 items-center justify-center rounded-full",
          clean ? "bg-green/15 text-green" : "bg-red/15 text-red",
        )}
      >
        <div className="absolute inset-0 -z-10 rounded-full blur-xl" style={{ background: clean ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }} />
        {clean ? <ShieldCheck className="h-12 w-12" /> : <Shield className="h-12 w-12" />}
        {!clean && <span className="absolute inset-0 -z-5 animate-ping rounded-full bg-red/20" />}
      </motion.div>

      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
        {loading ? "Checking your exposure…" : clean
          ? "Nothing exposed in the breach corpus"
          : `${breaches} exposure${breaches === 1 ? "" : "s"} found in breach + stealer logs`}
      </h2>

      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        {loading
          ? "Checking 1.2B+ breached records and live infostealer logs for your email and credentials."
          : clean
            ? "Nothing in the breach or stealer-log corpus yet — let's lock it down. Add a monitored account to keep it that way."
            : "These credentials are already in attackers' hands or were captured by infostealer malware. Vault a strong, unique password for each account to fortify the wall."}
      </p>

      {accounts > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          {accounts} {accounts === 1 ? "account is" : "accounts are"} currently behind the shield.
        </p>
      )}

      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        <Button onClick={onNext} className="h-12 w-full text-sm font-semibold" disabled={loading}>
          {clean ? "Add your first account" : "Vault your credentials"}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <button onClick={onSkip} className="text-xs text-ink-muted transition-colors hover:text-ink">
          I'll do this later
        </button>
      </div>
    </motion.div>
  );
}

/** Step 2 — Quick add: pick an account type and enter the identifier. */
function StepAddAccount({ busy, onSubmit, onSkip }: {
  busy: boolean;
  onSubmit: (site: string, identifier: string) => void;
  onSkip: () => void;
}) {
  const [site, setSite] = useState("google");
  const [identifier, setIdentifier] = useState("");

  function handle() {
    if (!identifier.trim()) return;
    onSubmit(site, identifier.trim());
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-1 flex-col items-center px-6 text-center"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cyan/15 text-cyan">
        <ShieldCheck className="h-8 w-8" />
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Put an account behind the shield</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">Pick the account type and enter your email or username for that service.</p>

      <div className="mt-6 grid w-full max-w-sm grid-cols-4 gap-2">
        {QUICK_SITES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSite(s.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] font-medium transition-all",
              site === s.id ? "border-cyan/40 bg-cyan/[0.06] text-ink" : "border-white/[0.06] bg-white/[0.02] text-ink-muted hover:border-white/[0.12]",
            )}
          >
            <s.icon className={cn("h-4 w-4", site === s.id ? s.color : "text-ink-faint")} />
            {s.name}
          </button>
        ))}
      </div>

      <div className="mt-4 w-full max-w-sm space-y-3">
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handle()}
          placeholder="you@example.com"
          className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-green/40"
          autoFocus
        />
        <Button onClick={handle} disabled={busy || !identifier.trim()} className="h-11 w-full text-sm font-semibold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {busy ? "Vaulting…" : "Vault this account"}
        </Button>
        <button onClick={onSkip} className="block w-full text-center text-xs text-ink-muted transition-colors hover:text-ink">
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}

/** Step 3 — Wall status: what the vault now protects. */
function StepWallStatus({ summary, loading, onDone }: {
  summary: any;
  loading: boolean;
  onDone: () => void;
}) {
  const walls = summary?.walls || {};
  const score = summary?.securityScore ?? 100;
  const accountCount = summary?.accounts ?? summary?.watched ?? 0;
  const intel = summary?.intelligence || {};
  const blast = intel.blast_radius ?? 0;
  const weakest = intel.weakest;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-1 flex-col items-center px-6 text-center"
    >
      <div className="relative mb-6">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 180, damping: 12 }}
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green/20 to-cyan/10"
        >
          <div className="absolute inset-0 -z-10 rounded-full bg-green/25 blur-xl" />
          <ShieldCheck className="h-12 w-12 text-green" />
        </motion.div>
      </div>

      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Your shield is standing</h2>

      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        {loading
          ? "Pulling together your defence report…"
          : accountCount > 0
            ? `We're watching ${accountCount} ${accountCount === 1 ? "account" : "accounts"} for you, and the shield re-sweeps breach + stealer corpora every 6 hours.`
            : "Add monitored accounts to start the wall standing guard."}
      </p>

      {!loading && (
        <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-3">
          <WallStat label="Fortified" value={walls.fortified ?? 0} tone="green" />
          <WallStat label="At risk" value={walls.at_risk ?? 0} tone="amber" />
          <WallStat label="Breached" value={walls.breached ?? 0} tone="red" />
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5 text-green" /> Credential vault</span>
          <span className="flex items-center gap-1"><Network className="h-3.5 w-3.5 text-violet" /> {blast} in blast radius</span>
          {weakest ? (
            <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-amber" /> {weakest.score}/100 weakest · {weakest.site}</span>
          ) : (
            <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-cyan" /> {score}% shield score</span>
          )}
        </div>
      )}

      {!loading && (
        <p className="mt-3 text-xs text-ink-faint">
          Auto-sweep on: breach dumps + infostealer logs re-checked every 6h · blast radius mapped per credential
        </p>
      )}

      {!loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4 flex max-w-xs items-start gap-2 rounded-xl border border-white/[0.06] bg-surface-1/40 px-3 py-2.5 text-left"
        >
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet" />
          <p className="text-[11px] leading-relaxed text-ink-muted">
            A note from the team: every account you put here now stands between you and the people who
            shouldn&apos;t hold your keys. That&apos;s the whole point of the shield.
          </p>
        </motion.div>
      )}

      <Button onClick={onDone} className="mt-8 h-12 w-full max-w-xs text-sm font-semibold">
        Start using Enclave
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </motion.div>
  );
}

function WallStat({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" }) {
  const colors = {
    green: "text-green bg-green/15",
    amber: "text-amber bg-amber/15",
    red: "text-red bg-red/15",
  };
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-surface-1/40 p-3">
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold", colors[tone])}>
        {value}
      </span>
      <span className="text-[10px] text-ink-muted">{label}</span>
    </div>
  );
}

export function OnboardingWizard() {
  const { toast, setTab } = useApp();
  const [step, setStep] = useState<OnStep>(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [breaches, setBreaches] = useState(0);
  const [accounts, setAccounts] = useState(0);
  const [summary, setSummary] = useState<any | null>(null);

  // Kick off the passive breach scan immediately on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sum, accs, br]: any = await Promise.all([
          api.getAccountShieldSummary().catch(() => null),
          api.getAccountShieldAccounts().catch(() => null),
          api.getAccountShieldBreaches().catch(() => null),
        ]);
        if (!active) return;
        const accList = (accs as any)?.accounts ?? [];
        const brList = (br as any)?.breaches ?? [];
        const openBreaches = brList.filter((b: any) => b.status !== "resolved").length;
        setSummary(sum);
        setAccounts(accList.length);
        setBreaches(openBreaches);
        if (accList.length > 0) {
          setStep(3);
        }
      } catch {
        /* no data available */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function handleAddAccount(site: string, identifier: string) {
    setScanning(true);
    (async () => {
      try {
        await api.addAccountShieldAccount({ site, identifier });
        toast({ title: "Account behind the shield", body: "Credential will be vaulted after you set it." });
        const [sum, br]: any = await Promise.all([
          api.getAccountShieldSummary().catch(() => null),
          api.getAccountShieldBreaches().catch(() => null),
        ]);
        const brList = (br as any)?.breaches ?? [];
        setSummary(sum);
        setBreaches(brList.filter((b: any) => b.status !== "resolved").length);
        setAccounts((a) => a + 1);
        setStep(3);
      } catch (e: any) {
        toast({ title: "Failed to add account", body: e.message, variant: "error" });
      } finally {
        setScanning(false);
      }
    })();
  }

  function handleDone() {
    completeOnboarding();
    track("onboarding_complete");
    setDone(true);
  }

  function handleSkip() {
    completeOnboarding();
    track("onboarding_skip");
    setDone(true);
  }

  useEffect(() => {
    if (!done) return;
    setTab("home");
  }, [done, setTab]);

  if (done) return null;

  return (
    <div className="fixed inset-0 z-[91] flex items-center justify-center bg-[#04060a]/95 p-4 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-h-[560px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-2xl"
      >
        {/* Glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-green/20 blur-[100px]" />

        <div className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green" />
            <span className="text-xs font-bold tracking-tight text-ink-muted">ENCLAVE</span>
          </div>
          <button onClick={handleSkip} className="pointer-events-auto flex items-center gap-1 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-white/[0.05] hover:text-ink">
            <span className="text-xs">Skip</span>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="relative flex flex-1 flex-col pt-12">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <StepBreachResult
                key="result"
                loading={loading || scanning}
                breaches={breaches}
                accounts={accounts}
                onNext={() => setStep(1)}
                onSkip={handleSkip}
              />
            )}
            {step === 1 && (
              <StepAddAccount
                key="add"
                busy={scanning}
                onSubmit={handleAddAccount}
                onSkip={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <StepWallStatus
                key="wall"
                summary={summary}
                loading={false}
                onDone={handleDone}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-6 py-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                (step === 0 && i === 0) || (step === 1 && i === 1) || (step === 3 && i === 2) ? "bg-cyan" : "bg-white/10"
              )}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const PROGRESS_ITEMS = [
  { key: "shield", label: "Shield Set Up", icon: ShieldCheck },
  { key: "watch", label: "First Watched Account", icon: Shield },
  { key: "sweep", label: "Auto-Sweep Armed", icon: ScanSearch },
];

export function ProgressTracker() {
  const [dismissed, setDismissed] = useState(false);
  const [shield, setShield] = useState<any | null>(null);

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

  useEffect(() => {
    if (!show) return;
    let active = true;
    api
      .getAccountShieldSummary()
      .then((s) => active && setShield(s))
      .catch(() => {});
    return () => { active = false; };
  }, [show]);

  if (!show || dismissed) return null;

  const watched = shield?.accounts ?? shield?.watched ?? 0;
  const intel = shield?.intelligence || {};
  const blast = intel.blast_radius ?? 0;
  const intelDone = !!(intel.weakest || blast > 0 || (intel.exposed ?? 0) > 0);
  const allDone = watched > 0 && intelDone;

  const items = [
    { ...PROGRESS_ITEMS[0], done: watched > 0, count: watched > 0 ? 1 : 0 },
    { ...PROGRESS_ITEMS[1], done: watched > 0, count: watched > 0 ? 1 : 0 },
    { ...PROGRESS_ITEMS[2], count: intelDone ? 1 : 0, done: intelDone },
  ];

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