import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { Shield, Users, Check } from "lucide-react";

interface PlanModalProps {
  open: boolean;
  onClose: () => void;
}

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "3 URL scans/month",
      "1 deep scan/month",
      "Basic threat detection",
      "Email alerts",
      "Community access",
    ],
    color: "muted",
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    features: [
      "Unlimited URL scans",
      "10 deep scans/month",
      "Advanced AI detection",
      "Priority alerts",
      "Voice Shield",
      "Camera Immunizer",
      "Family protection (up to 3)",
      "Priority support",
    ],
    color: "cyan",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$29.99",
    period: "/month",
    features: [
      "Everything in Pro",
      "Unlimited deep scans",
      "Dark web monitoring",
      "Auto takedown service",
      "Rights Shield watermarking",
      "Biometric enrollment",
      "Family protection (up to 10)",
      "24/7 dedicated support",
      "API access",
    ],
    color: "purple",
  },
];

export function PlanModal({ open, onClose }: PlanModalProps) {
  const { toast } = useApp();
  const { user } = useAuth();
  const currentPlan = user?.plan || "free";

  function handleUpgrade(planName: string) {
    if (planName.toLowerCase() === currentPlan) {
      toast({ title: "You're already on this plan", variant: "info" });
      return;
    }
    toast({ 
      title: "Upgrade initiated", 
      body: `Redirecting to checkout for ${planName} plan...`,
      variant: "success" 
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green" />
            Choose Your Protection Plan
          </DialogTitle>
          <DialogDescription>
            Select the plan that best fits your security needs. All plans include our core protection features.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.name.toLowerCase() === currentPlan;
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-xl border p-5 transition-all ${
                  plan.popular
                    ? "border-cyan/40 bg-cyan/[0.03]"
                    : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge variant="cyan">Most Popular</Badge>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="font-display text-lg font-bold text-ink">
                    {plan.name}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-ink">
                      {plan.price}
                    </span>
                    <span className="text-sm text-ink-muted">{plan.period}</span>
                  </div>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                      <span className="text-ink-muted">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isCurrent ? "outline" : plan.popular ? "cyan" : "default"}
                  className="w-full"
                  onClick={() => handleUpgrade(plan.name)}
                  disabled={isCurrent}
                >
                  {isCurrent ? "Current Plan" : `Upgrade to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-purple" />
            <div>
              <p className="text-sm font-medium text-ink">Need a custom plan?</p>
              <p className="mt-1 text-xs text-ink-muted">
                Contact us for enterprise solutions with custom features, dedicated support, and volume pricing.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
