import { useEffect, useState } from "react";
import {
  User,
  Save,
  Loader2,
  CreditCard,
  Users,
  Gift,
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

export function SettingsView() {
  const { toast } = useApp();
  const { user, setUser, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [saving, setSaving] = useState(false);
  const [family, setFamily] = useState<any[]>([]);
  const [referral, setReferral] = useState<string>("");
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [fam, ref, subscription] = await Promise.all([
          api.listFamilyMembers().catch(() => []),
          api.getReferralCode().catch(() => ""),
          api.getSubscription().catch(() => null),
        ]);
        if (active) {
          setFamily(fam);
          if (typeof ref === "string") setReferral(ref);
          else if (ref?.code) setReferral(ref.code);
          setSub(subscription);
        }
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
                  <p className="text-xs text-ink-muted">
                    {plan === "free"
                      ? "3 scans · 1 deep scan"
                      : "Extended protection active"}
                  </p>
                </div>
              </div>
              <Button variant="glass" onClick={() => toast({ title: "Upgrade flow coming soon", variant: "info" })}>
                Upgrade
              </Button>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Family */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle>Family Protection</CardTitle>
              <CardDescription>Extend monitoring to loved ones</CardDescription>
            </CardHeader>
            <CardContent>
              {family.length === 0 ? (
                <div className="flex items-center gap-3 py-2 text-ink-muted">
                  <Users className="h-5 w-5 text-ink-faint" />
                  <p className="text-sm">No family members yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {family.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] p-3"
                    >
                      <Users className="h-4 w-4 text-green" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">{m.name}</p>
                        <p className="text-xs text-ink-muted">{m.relation}</p>
                      </div>
                      <Badge variant="cyan">Protected</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Referrals */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle>Referral Program</CardTitle>
              <CardDescription>Invite friends & earn rewards</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/15 text-purple">
                  <Gift className="h-5 w-5" />
                </div>
                {referral ? (
                  <div>
                    <p className="font-mono text-sm font-semibold text-ink">{referral}</p>
                    <p className="text-xs text-ink-muted">Your referral code</p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">Share your code to earn perks</p>
                )}
              </div>
              <Button
                variant="glass"
                onClick={() => {
                  if (referral) {
                    navigator.clipboard?.writeText(referral);
                    toast({ title: "Referral code copied", variant: "success" });
                  }
                }}
              >
                Copy
              </Button>
            </CardContent>
          </Card>
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
    </div>
  );
}
