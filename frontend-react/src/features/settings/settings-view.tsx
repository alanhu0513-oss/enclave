import { useEffect, useState } from "react";
import {
  User,
  Save,
  Loader2,
  CreditCard,
  Bell,
  LogOut,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { FamilyPanel } from "./family-panel";
import { ReferralPanel } from "./referral-panel";
import { PlanModal } from "@/components/shell/plan-modal";

export function SettingsView() {
  const { toast } = useApp();
  const { user, setUser, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [saving, setSaving] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const subscription = await api.getSubscription().catch(() => null);
        if (active) setSub(subscription);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      await api.updateProfile(fullName);
      setUser({ ...user, fullName });
      toast({ title: "Profile updated", variant: "success" });
    } catch (e: any) {
      toast({ title: "Update failed", body: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const plan = sub?.tier || user?.plan || "free";

  const TIER_INFO: Record<string, { tagline: string; features: string[] }> = {
    free: {
      tagline: "Essential protection on demand",
      features: ["3 scans/month", "On-demand web search", "Email alerts"],
    },
    detection_only: {
      tagline: "Basic detection capabilities",
      features: ["10 scans/month", "On-demand web search", "Priority alerts"],
    },
    pro: {
      tagline: "Round-the-clock identity monitoring",
      features: ["50 scans/month", "Hourly surface monitoring", "2 takedowns/mo with evidence"],
    },
    shield: {
      tagline: "Protect your whole household",
      features: ["200 scans/month (5 members)", "Dark web monitoring", "10 takedowns/mo"],
    },
    business: {
      tagline: "Enterprise-grade identity security",
      features: ["Unlimited scans, 10 seats", "15-min real-time monitoring", "Unlimited takedowns"],
    },
  };
  const tierInfo = TIER_INFO[plan] ?? TIER_INFO.free;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Vault Settings</h2>
            <p className="text-sm text-ink-muted">Manage your account & protection</p>
          </div>
        </div>
        <Badge variant={plan === "free" ? "muted" : "cyan"}>
          {String(plan).toUpperCase()}
        </Badge>
      </div>

      <StaggerContainer className="space-y-5">
        {/* Profile */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                    Full name
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                    Email
                  </label>
                  <Input value={user?.email || ""} disabled />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Plan */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>Your current protection tier</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/15 text-amber">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink capitalize">{plan} plan</p>
                  <p className="text-xs text-ink-muted">{tierInfo.tagline}</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {tierInfo.features.map((f) => (
                      <li key={f} className="text-xs text-ink-faint">· {f}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button variant="glass" onClick={() => setPlanOpen(true)}>
                Upgrade
              </Button>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Family */}
        <StaggerItem>
          <FamilyPanel />
        </StaggerItem>

        {/* Referrals */}
        <StaggerItem>
          <ReferralPanel />
        </StaggerItem>

        {/* Notifications + Sign out */}
        <StaggerItem className="grid gap-5 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/15 text-green">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-sm text-ink-muted">
                Email & push alerts are active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/15 text-red">
                  <LogOut className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-ink">Sign out</p>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
    </div>
  );
}
