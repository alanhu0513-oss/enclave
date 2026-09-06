import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Check,
  Loader2,
  ExternalLink,
  ChevronRight,
  Siren,
  Sparkles,
  KeyRound,
  Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanModalProps {
  open: boolean;
  onClose: () => void;
}

const ORDER = ["free", "pro", "shield", "family", "business"];
const POPULAR = new Set(["shield"]);
const YEARLY_PRICE = 1999;
const MONTHLY_PRICE = 999;

function fmtPrice(usd: number) {
  if (usd === 0) return "$0";
  return "$" + (usd / 100).toLocaleString("en-US", { minimumFractionDigits: usd % 100 === 0 ? 0 : 2 });
}

function fmtWeekly(usd: number) {
  return "$" + (usd / 100 / 52).toFixed(2);
}

function getTierName(id: string, tiers: any[]) {
  const t = tiers.find((x) => x.id === id);
  return t?.name || id;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  tagline?: string;
  features?: string[];
}

export function PlanModal({ open, onClose }: PlanModalProps) {
  const { toast } = useApp();
  const { user } = useAuth();
  const [tiers, setTiers] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [shieldSummary, setShieldSummary] = useState<any | null>(null);
  const [shieldLoading, setShieldLoading] = useState(false);
  const currentPlan = user?.plan || "free";
  const onPaidPlan = currentPlan !== "free";

  useEffect(() => {
    if (!open) return;
    track("plan_view");
    let active = true;
    (async () => {
      try {
        const res: any = await api.getTiers();
        const list = (res?.tiers ? Object.values(res.tiers) : []).filter(Boolean);
        if (active && list.length) {
          list.sort((a: any, b: any) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
          setTiers(list);
        }
      } catch {
        /* use empty */
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setShieldSummary(null);
    if (onPaidPlan) {
      setStep(3);
      return;
    }
    // Personalized outcome: pull live shield status so the first screen shows real value.
    let active = true;
    setShieldLoading(true);
    (async () => {
      try {
        const sum: any = await api.getAccountShieldSummary();
        if (!active) return;
        setShieldSummary(sum);
      } catch {
        /* shield data is optional */
      } finally {
        if (active) setShieldLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, onPaidPlan]);

  async function handleUpgrade(tierId: string) {
    if (busy) return;
    setBusy(tierId);
    try {
      if (tierId === currentPlan) {
        toast({ title: "You're already on this plan", variant: "info" });
        return;
      }
      const success = window.location.origin + "/billing/success";
      const cancel = window.location.origin + "/billing/cancel";
      const session: any = await api.startCheckout(tierId, success, cancel);
      track("checkout_started", { tier: tierId, source: "paywall_step3" });
      if (session?.url) {
        window.location.href = session.url;
      } else {
        toast({ title: "Checkout available", body: "Redirecting shortly…", variant: "success" });
        onClose();
      }
    } catch (e: any) {
      toast({ title: "Upgrade failed", body: e.message, variant: "error" });
      setBusy(null);
    }
  }

  async function handleManage() {
    setBusy("manage");
    try {
      const session: any = await api.createPortal(window.location.origin + "/billing/manage");
      if (session?.url) window.location.href = session.url;
    } catch (e: any) {
      toast({ title: "Could not open billing", body: e.message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const following = (shieldSummary as any)?.accounts ?? shieldSummary?.watched ?? 0;
  const breaches = (shieldSummary as any)?.openBreaches ?? 0;
  const locked = (shieldSummary as any)?.lockdowns ?? 0;
  const totalBreaches = (shieldSummary as any)?.totalBreaches ?? 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <Header onClose={onClose} title={onPaidPlan ? "Manage Protection Plan" : "Get Enclave Plus"} />

        {/* Multi-page flow: outcome → risk reduction → pricing */}
        <div className="relative min-h-[480px] p-6">
          <AnimatePresence mode="wait">
            {onPaidPlan || step === 3 ? (
              <StepPricingAll key="pricing-all" tiers={tiers} currentPlan={currentPlan} busy={busy} onUpgrade={handleUpgrade} onManage={handleManage} />
            ) : step === 0 ? (
              <StepOutcome key="outcome" loading={shieldLoading} following={following} breaches={breaches} locked={locked} totalBreaches={totalBreaches} onNext={() => setStep(1)} />
            ) : step === 1 ? (
              <StepRisk key="risk" tiers={tiers} onNext={() => setStep(2)} />
            ) : (
              <StepPricing key="pricing" tiers={tiers} currentPlan={currentPlan} busy={busy} onUpgrade={handleUpgrade} onAllPlans={() => setStep(3)} />
            )}
          </AnimatePresence>
        </div>

        {/* Stepper for the multi-page flow */}
        {!onPaidPlan && (
          <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-6 py-4">
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn("h-1.5 w-8 rounded-full transition-colors", i === step ? "bg-cyan" : i < step ? "bg-green/50" : "bg-white/10")} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Header({ onClose, title }: { onClose: () => void; title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.07] bg-gradient-to-r from-cyan/10 via-purple/10 to-transparent px-6 py-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-cyan" />
        <span className="font-display text-sm font-bold tracking-tight text-ink">{title}</span>
      </div>
      <button onClick={onClose} className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-white/[0.05] hover:text-ink">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** Step 1 — Outcome selling: personalized scan results first. */
function StepOutcome({ loading, following, breaches, locked, totalBreaches, onNext }: {
  loading: boolean;
  following: number;
  breaches: number;
  locked: number;
  totalBreaches: number;
  onNext: () => void;
}) {
  const doingWell = breaches === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col"
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-cyan" />
            <p className="text-sm text-ink-muted">Scanning your exposure…</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 14 }}
              className={cn(
                "relative mb-6 flex h-20 w-20 items-center justify-center rounded-full",
                doingWell ? "bg-green/15 text-green" : "bg-red/15 text-red",
              )}
            >
              {doingWell ? <Shield className="h-10 w-10" /> : <Siren className="h-10 w-10" />}
              {!doingWell && (
                <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-red/20" />
              )}
            </motion.div>
            <h3 className="max-w-sm font-display text-2xl font-bold tracking-tight text-ink">
              {loading ? "Loading…" : doingWell
                ? "Your accounts look protected"
                : `${breaches} exposed ${breaches === 1 ? "password is" : "passwords are"} on the dark web`}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-ink-muted">
              {doingWell
                ? "You're on the Free plan. Pro goes beyond a single scan — it watches every account continuously and blocks breaches before they spread."
                : following > 0
                  ? `We monitor ${following} ${following === 1 ? "account" : "accounts"} for you. Pro keeps this wall standing around the clock.`
                  : "Continuous monitoring catches breaches the moment they surface — not a month later."}
            </p>
            {doingWell && (
              <div className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
                <Check className="h-3.5 w-3.5 text-green" />
                No open findings on your watched accounts
              </div>
            )}
            {totalBreaches > 0 && locked > 0 && (
              <p className="mt-3 text-xs text-amber">
                {locked} lockdown {locked === 1 ? "playbook" : "playbooks"} have been issued.
              </p>
            )}
          </>
        )}
      </div>
      <Button onClick={onNext} disabled={loading} className="mt-6 h-12 w-full text-sm font-semibold">
        See how Pro protects this <ChevronRight className="ml-1.5 h-4 w-4" />
      </Button>
    </motion.div>
  );
}

/** Step 2 — Risk reduction: the outcome, framed with zero-commitment language. */
function StepRisk({ tiers, onNext }: { tiers: any[]; onNext: () => void }) {
  const shield = tiers.find((t) => t.id === "shield");
  const headline = shield?.tagline || "Continuous protection, your terms";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col"
    >
      <div className="flex-1 space-y-4">
        <div className="rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/10 to-transparent p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Pro protection, your terms</h3>
              <p className="mt-1 text-sm text-ink-muted">{headline}</p>
            </div>
          </div>
        </div>

        <ul className="space-y-3">
          <RiskRow icon={KeyRound} text="Vault every credential — encrypted, never shown to anyone" done />
          <RiskRow icon={Shield} text="Block weak, reused, and breached passwords at the gate" done />
          <RiskRow icon={Fingerprint} text="Escalate to step-by-step lockdown playbooks when breached" done />
        </ul>

        <div className="rounded-xl border border-white/[0.07] bg-surface-1/40 p-4">
          <p className="text-sm font-medium text-ink">Zero commitment, zero surprises</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="cyan">Cancel anytime</Badge>
            <Badge variant="muted">14-day free trial on annual</Badge>
            <Badge variant="muted">No hidden fees</Badge>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            You&apos;ll never be charged at signup for a plan you don&apos;t use — start the trial and keep your wall standing.
          </p>
        </div>
      </div>
      <Button onClick={onNext} className="mt-6 h-12 w-full text-sm font-semibold">
        See plans <ChevronRight className="ml-1.5 h-4 w-4" />
      </Button>
    </motion.div>
  );
}

/** Step 3 — Pricing: two options only, yearly default, weekly anchoring, view-all behind sheet. */
function StepPricing({ tiers, currentPlan, busy, onUpgrade, onAllPlans }: {
  tiers: any[];
  currentPlan: string;
  busy: string | null;
  onUpgrade: (id: string) => void;
  onAllPlans: () => void;
}) {
  const shield = tiers.find((t) => t.id === "shield");
  const yearly = shield?.price ?? YEARLY_PRICE;
  const monthly = MONTHLY_PRICE;
  const yearlyName = shield?.name || "Shield";
  const monthlyName = tiers.find((t) => t.id === "pro")?.name || "Pro";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col"
    >
      <div className="flex-1">
        <div className="mb-5">
          <h3 className="font-display text-xl font-bold text-ink">Pick your protection level</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Yearly saves 33% and includes a 14-day free trial. Both cancel anytime.
          </p>
        </div>

        <div className="space-y-3">
          {/* Yearly — highlighted default */}
          <PlanCard
            name={yearlyName}
            tierId="shield"
            price={yearly}
            period="year"
            weekly={fmtWeekly(yearly)}
            popular
            tagline="Extra months of dark-web scanning + shown prominently"
            busy={busy}
            onPick={() => onUpgrade("shield")}
          >
            <li className="flex items-start gap-2 text-xs text-ink-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />14-day free trial, cancel before you pay</li>
            <li className="flex items-start gap-2 text-xs text-ink-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />Continuous dark-web + paste monitoring</li>
            <li className="flex items-start gap-2 text-xs text-ink-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />Unlimited lockdown playbooks</li>
          </PlanCard>

          {/* Monthly — the "not ready to commit a year" escape hatch */}
          <PlanCard
            name={monthlyName}
            tierId="pro"
            price={monthly}
            period="month"
            busy={busy}
            onPick={() => onUpgrade("pro")}
          >
            <li className="flex items-start gap-2 text-xs text-ink-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />Monthly billing, cancel anytime</li>
            <li className="flex items-start gap-2 text-xs text-ink-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />Same wall, fewer advanced scans</li>
          </PlanCard>
        </div>

        <button onClick={onAllPlans} className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 text-xs text-ink-muted transition-colors hover:border-white/[0.12] hover:text-ink">
          View all plans
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {currentPlan !== "free" && (
          <p className="mt-3 text-center text-xs text-ink-muted">
            You&apos;re on <span className="font-semibold text-ink">{getTierName(currentPlan, tiers)}</span>.
          </p>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">
        Secured by Stripe · No charge until the trial ends
      </p>
    </motion.div>
  );
}

function PlanCard({ name, tierId, price, period, weekly, popular, tagline, busy, onPick, children }: {
  name: string;
  tierId: string;
  price: number;
  period: "month" | "year";
  weekly?: string;
  popular?: boolean;
  tagline?: string;
  busy: string | null;
  onPick: () => void;
  children: React.ReactNode;
}) {
  const loading = busy !== null;
  return (
    <motion.div
      whileHover={{ scale: popular ? 1.02 : 1.005, y: popular ? -2 : 0 }}
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border p-4",
        popular ? "border-cyan/40 bg-gradient-to-br from-cyan/[0.08] to-transparent" : "border-white/[0.07] bg-surface-1/40",
      )}
    >
      {popular && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-cyan px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
          Most popular
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">{name}</p>
          {tagline && <p className="mt-0.5 text-xs text-ink-muted">{tagline}</p>}
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold text-ink">{fmtPrice(price)}</p>
          <p className="text-xs text-ink-muted">per {period}{popular && period === "year" && weekly ? ` · ${weekly}/week` : ""}</p>
        </div>
      </div>
      <ul className="space-y-1.5">{children}</ul>
      <Button variant={popular ? "cyan" : "default"} className="w-full" disabled={loading} onClick={onPick}>
        {busy === tierId ? <Loader2 className="h-4 w-4 animate-spin" /> : popular ? <Sparkles className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
        {popular ? "Start 14-day free trial" : "Get started"}
        <ChevronRight className="ml-1.5 h-4 w-4" />
      </Button>
    </motion.div>
  );
}

/** Step 3b — Full tier table for those who click "View all plans". */
function StepPricingAll({ tiers, currentPlan, busy, onUpgrade, onManage }: {
  tiers: any[];
  currentPlan: string;
  busy: string | null;
  onUpgrade: (id: string) => void;
  onManage: () => void;
}) {
  const onPaidPlan = currentPlan !== "free";
  const list = tiers.filter((t) => t.id !== "free");
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col"
    >
      <div className="mb-4 flex items-center gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">All plans</h3>
          <p className="text-xs text-ink-muted">Compare and choose the level that fits.</p>
        </div>
        {onPaidPlan && (
          <Button variant="glass" size="sm" className="ml-auto" onClick={onManage} disabled={busy !== null}>
            {busy === "manage" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Manage
          </Button>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {list.length === 0 ? (
          <FALLBACK_ROW currentPlan={currentPlan} busy={busy} onUpgrade={onUpgrade} />
        ) : (
          list.map((p: any) => (
            <AllPlanRow key={p.id} plan={p} currentPlan={currentPlan} busy={busy} onUpgrade={onUpgrade} />
          ))
        )}
      </div>
    </motion.div>
  );
}

function AllPlanRow({ plan, currentPlan, busy, onUpgrade }: {
  plan: Plan;
  currentPlan: string;
  busy: string | null;
  onUpgrade: (id: string) => void;
}) {
  const isCurrent = plan.id === currentPlan;
  const isPopular = POPULAR.has(plan.id);
  return (
    <div className={cn(
      "flex items-center justify-between gap-3 rounded-xl border p-3",
      isPopular ? "border-cyan/25 bg-cyan/[0.04]" : "border-white/[0.06] bg-surface-1/40",
    )}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">{plan.name}</p>
          {isPopular && <Badge variant="cyan">Popular</Badge>}
          {isCurrent && <Badge variant="green">Current</Badge>}
        </div>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-display text-lg font-bold text-ink">{fmtPrice(plan.price)}</span>
          <span className="text-xs text-ink-muted">/month</span>
        </p>
      </div>
      <Button
        size="sm"
        variant={isPopular ? "cyan" : isCurrent ? "outline" : "default"}
        disabled={isCurrent || busy !== null}
        onClick={() => onUpgrade(plan.id)}
      >
        {busy === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : plan.price === 0 ? "Free" : "Upgrade"}
      </Button>
    </div>
  );
}

function FALLBACK_ROW({ currentPlan, busy, onUpgrade }: {
  currentPlan: string;
  busy: string | null;
  onUpgrade: (id: string) => void;
}) {
  const fd = [
    { id: "pro", name: "Pro", price: 999 },
    { id: "shield", name: "Shield", price: 1999 },
  ];
  return (
    <div className="space-y-2">
      {fd.map((p) => (
        <AllPlanRow key={p.id} plan={p as Plan} currentPlan={currentPlan} busy={busy} onUpgrade={onUpgrade} />
      ))}
    </div>
  );
}

function RiskRow({ icon: Icon, text, done }: { icon: typeof Shield; text: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
        <Icon className="h-4 w-4" />
      </span>
      <p className="pt-1 text-sm text-ink-muted">{text}</p>
      {done && <Check className="ml-auto mt-2 h-4 w-4 shrink-0 text-green" />}
    </div>
  );
}