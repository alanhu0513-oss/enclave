import { useEffect, useState } from "react";
import {
  User,
  Save,
  Loader2,
  CreditCard,
  Bell,
  LogOut,
  CheckCircle2,
  Clock,
  Settings,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";
import { FamilyPanel } from "./family-panel";
import { ReferralPanel } from "./referral-panel";
import { PlanModal } from "@/components/shell/plan-modal";
import { FeatureBoard } from "@/features/feedback/feature-board";
import { timeAgo, cn } from "@/lib/utils";

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
      <FadeIn>
        <SectionHeader
          icon={Settings}
          title="Vault Settings"
          description="Manage your account & protection"
          action={
            <Badge variant={plan === "free" ? "muted" : "cyan"} className="text-sm">
              {String(plan).toUpperCase()}
            </Badge>
          }
        />
      </FadeIn>

      <StaggerContainer className="space-y-5">
        {/* Profile */}
        <StaggerItem>
          <Kinetic>
            <Card className="relative overflow-hidden border-white/[0.06]">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 to-transparent" />
              <div className="relative">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Profile</CardTitle>
                      <CardDescription>Update your personal details</CardDescription>
                    </div>
                  </div>
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
              </div>
            </Card>
          </Kinetic>
        </StaggerItem>

        {/* Plan */}
        <StaggerItem>
          <Kinetic>
            <Card className="relative overflow-hidden border-white/[0.06]">
              <div className="absolute inset-0 bg-gradient-to-br from-amber/5 to-transparent" />
              <div className="relative">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/15 text-amber">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Subscription</CardTitle>
                      <CardDescription>Your current protection tier</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
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
              </div>
            </Card>
          </Kinetic>
        </StaggerItem>

        {/* Family */}
        <StaggerItem>
          <FamilyPanel />
        </StaggerItem>

        {/* Referrals */}
        <StaggerItem>
          <ReferralPanel />
        </StaggerItem>

        {/* Feature Requests */}
        <StaggerItem>
          <FeatureBoard />
        </StaggerItem>

        {/* Notifications + Sign out */}
        <StaggerItem>
          <NotificationPrefs />
        </StaggerItem>

        <StaggerItem>
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

function NotificationPrefs() {
  const { toast } = useApp();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [prefs, notifs] = await Promise.all([
          api.getNotificationPreferences(),
          api.getNotifications({ limit: 5 }),
        ]);
        setEmailEnabled((prefs as any)?.emailNotifications !== false);
        setRecentNotifs(Array.isArray(notifs) ? notifs : []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggleEmail() {
    const next = !emailEnabled;
    setEmailEnabled(next);
    try {
      await api.updateNotificationPreferences({ emailNotifications: next });
      toast({ title: next ? "Email alerts enabled" : "Email alerts disabled", variant: "success" });
    } catch (e: any) {
      setEmailEnabled(!next);
      toast({ title: "Failed to update", variant: "error" });
    }
  }

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-green" />
          <CardTitle>Notifications</CardTitle>
        </div>
        <CardDescription>Manage alert delivery and view recent notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Email alerts</p>
            <p className="text-xs text-ink-muted">Receive threat alerts and takedown updates via email</p>
          </div>
          <button
            onClick={toggleEmail}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              emailEnabled ? "bg-green" : "bg-white/10"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                emailEnabled ? "left-[22px]" : "left-0.5"
              )}
            />
          </button>
        </div>

        {recentNotifs.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-muted">Recent</p>
            <div className="space-y-2">
              {recentNotifs.map((n: any) => (
                <div key={n.id} className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2.5">
                  {n.read ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  ) : (
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink">{n.title}</p>
                    <p className="text-[11px] text-ink-muted truncate">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-ink-faint">{timeAgo(n.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
