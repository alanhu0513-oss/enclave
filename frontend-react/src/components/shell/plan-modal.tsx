import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Shield, Users, Check, Loader2, ExternalLink } from "lucide-react";

interface PlanModalProps {
  open: boolean;
  onClose: () => void;
}

const FALLBACK_TIERS = [
  { id: "free", name: "Free", price: 0, features: ["3 deepfake scans/month", "On-demand web search", "Email alerts", "Local heuristic fallback"] },
  { id: "pro", name: "Individual Pro", price: 999, features: ["50 scans/month", "Hourly surface monitoring (web/Reddit/paste)", "2 takedowns/mo with evidence chain", "Priority alerts"] },
  { id: "shield", name: "Family", price: 1999, features: ["200 scans/month, up to 5 members", "Dark web monitoring (Ahmia)", "10 takedowns/mo", "Voice authentication"] },
  { id: "business", name: "Business", price: 4999, features: ["Unlimited scans, 10 seats", "15-min real-time monitoring incl. social", "Unlimited takedowns", "API access (10k calls/mo)"] },
];

const ORDER = ["free", "detection_only", "pro", "shield", "business"];
const POPULAR = new Set(["pro", "business"]);

function fmtPrice(usd: number) {
  if (usd === 0) return "$0";
  return "$" + (usd / 100).toLocaleString("en-US", { minimumFractionDigits: usd % 100 === 0 ? 0 : 2 });
}

export function PlanModal({ open, onClose }: PlanModalProps) {
  const { toast } = useApp();
  const { user } = useAuth();
  const [tiers, setTiers] = useState<any[]>(FALLBACK_TIERS);
  const [busy, setBusy] = useState<string | null>(null);
  const currentPlan = user?.plan || "free";

  useEffect(() => {
    if (!open) return;
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
        /* use fallback */
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

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

  const onPaidPlan = currentPlan !== "free";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green" />
            Choose Your Protection Plan
          </DialogTitle>
          <DialogDescription>
            Select the plan that best fits your security needs. You'll be taken to secure Stripe checkout to complete your subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const popular = POPULAR.has(plan.id) && plan.id !== "free";
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-4 transition-all ${
                  popular ? "border-cyan/40 bg-cyan/[0.03]" : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                {popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge variant="cyan">Popular</Badge>
                  </div>
                )}

                <div className="mb-3">
                  <h3 className="font-display text-base font-bold text-ink">{plan.name}</h3>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold text-ink">
                      {fmtPrice(plan.price)}
                    </span>
                    <span className="text-xs text-ink-muted">/month</span>
                  </div>
                </div>

                <ul className="mb-4 flex-1 space-y-2">
                  {(plan.features || []).map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-ink-muted">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isCurrent ? "outline" : popular ? "cyan" : "default"}
                  className="w-full"
                  disabled={isCurrent || busy !== null}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {busy === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : plan.price === 0 ? (
                    "Free"
                  ) : (
                    "Upgrade"
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-purple" />
            <div>
              <p className="text-sm font-medium text-ink">Need a custom plan?</p>
              <p className="mt-1 text-xs text-ink-muted">
                Contact us for enterprise solutions with custom features, dedicated support, and volume pricing.
              </p>
            </div>
          </div>
          {onPaidPlan && (
            <Button variant="glass" onClick={handleManage} disabled={busy !== null}>
              {busy === "manage" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Manage subscription
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
