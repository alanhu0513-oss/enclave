import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Shield,
  ShieldCheck,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Star,
  Zap,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn, SPRING } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

interface InsurancePlan {
  id: string;
  name: string;
  monthlyPrice: number;
  coverageAmount: number;
  features: string[];
}

interface InsuranceClaim {
  id: string;
  alertId: string;
  description: string;
  damages: number;
  status: string;
  coverageAmount: number;
  createdAt: string;
}

const PLANS: InsurancePlan[] = [
  {
    id: "basic",
    name: "Basic Shield",
    monthlyPrice: 2.99,
    coverageAmount: 10000,
    features: [
      "Coverage up to $10,000",
      "Legal consultation (1 hour)",
      "Evidence preservation",
      "Takedown assistance"
    ]
  },
  {
    id: "pro",
    name: "Pro Shield",
    monthlyPrice: 4.99,
    coverageAmount: 25000,
    features: [
      "Coverage up to $25,000",
      "Legal consultation (3 hours)",
      "PR crisis support",
      "Evidence preservation",
      "Priority takedown",
      "Reputation monitoring"
    ]
  },
  {
    id: "max",
    name: "Max Shield",
    monthlyPrice: 9.99,
    coverageAmount: 50000,
    features: [
      "Coverage up to $50,000",
      "Unlimited legal consultation",
      "Full PR crisis management",
      "Evidence preservation",
      "Priority takedown",
      "Reputation monitoring",
      "Identity restoration",
      "Lost wages compensation"
    ]
  }
];

const STATUS_COLORS: Record<string, string> = {
  pending: "amber",
  under_review: "cyan",
  approved: "green",
  denied: "red",
  paid: "green",
};

export function InsuranceView() {
  const { toast } = useApp();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  async function load() {
    try {
      const [statusRes, claimsRes] = await Promise.all([
        api.getInsuranceStatus(),
        api.getInsuranceClaims(),
      ]);
      setCurrentPlan(statusRes?.policy?.plan || null);
      setClaims(claimsRes?.claims || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function subscribe(planId: string) {
    setSubscribing(planId);
    try {
      await api.subscribeInsurance(planId);
      setCurrentPlan(planId);
      toast({ title: "Insurance activated", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: -10, scale: 1.1 }}
              transition={SPRING}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber/15 text-amber"
            >
              <Shield className="h-6 w-6" />
            </motion.div>
            <div>
              <h1 className="font-display text-2xl font-bold text-ink">Deepfake Insurance</h1>
              <p className="text-sm text-ink-muted">Financial protection against identity fraud</p>
            </div>
          </div>
          {currentPlan && (
            <Badge variant="green" className="text-sm">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              {PLANS.find(p => p.id === currentPlan)?.name} Active
            </Badge>
          )}
        </div>
      </FadeIn>

      {!currentPlan && (
        <FadeIn delay={0.1}>
          <Card className="border-amber/20 bg-amber/[0.03]">
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertTriangle className="h-5 w-5 text-amber" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">No insurance policy active</p>
                <p className="text-xs text-ink-muted">Add deepfake insurance for financial protection if your identity is misused.</p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <div>
        <FadeIn delay={0.15}>
          <h2 className="mb-4 text-lg font-semibold text-ink">Insurance Plans</h2>
        </FadeIn>
        <StaggerContainer className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <StaggerItem key={plan.id}>
              <Kinetic>
                <Card className={cn(
                  "relative transition-shadow",
                  currentPlan === plan.id && "border-green/30 shadow-lg shadow-green/10",
                  plan.id === "pro" && "border-cyan/20"
                )}>
                  {plan.id === "pro" && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="cyan" className="px-3">
                        <Star className="h-3 w-3 mr-1" /> Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pt-6">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-ink">${plan.monthlyPrice}</span>
                      <span className="text-sm text-ink-muted">/month</span>
                    </div>
                    <CardDescription className="mt-1">
                      Up to ${(plan.coverageAmount / 1000).toFixed(0)}k coverage
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink-muted">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={currentPlan === plan.id ? "glass" : plan.id === "pro" ? "cyan" : "default"}
                      className="w-full"
                      disabled={currentPlan === plan.id || subscribing === plan.id}
                      onClick={() => subscribe(plan.id)}
                    >
                      {subscribing === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : currentPlan === plan.id ? (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      {currentPlan === plan.id ? "Current Plan" : "Activate"}
                    </Button>
                  </CardContent>
                </Card>
              </Kinetic>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>

      {claims.length > 0 && (
        <FadeIn delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan" />
                Your Claims
              </CardTitle>
              <CardDescription>{claims.length} total claims</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {claims.map((claim) => (
                <div key={claim.id} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{claim.description}</p>
                    <p className="text-xs text-ink-muted">
                      ${claim.damages.toLocaleString()} damages · Filed {new Date(claim.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={STATUS_COLORS[claim.status] as any}>
                    {claim.status.replace("_", " ")}
                  </Badge>
                  <span className="text-sm font-mono text-ink-muted">
                    ${claim.coverageAmount.toLocaleString()} max
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={0.35}>
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { icon: Shield, title: "Activate", desc: "Choose a plan and activate insurance" },
                { icon: AlertTriangle, title: "Report", desc: "File a claim when a deepfake is found" },
                { icon: FileText, title: "Review", desc: "We review evidence and verify damages" },
                { icon: DollarSign, title: "Payout", desc: "Receive compensation up to coverage limit" },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-ink">{step.title}</p>
                  <p className="text-xs text-ink-muted">{step.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
