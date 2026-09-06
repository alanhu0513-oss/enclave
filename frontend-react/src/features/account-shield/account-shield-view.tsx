import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Trash2,
  ScanSearch,
  Lock,
  Mail,
  Gamepad2,
  Landmark,
  CreditCard,
  Globe,
  Wallet,
  Users,
  Briefcase,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  KeyRound,
  Fingerprint,
  Siren,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader, EmptyState } from "@/components/ui/dashboard";
import { StaggerContainer } from "@/components/ui/motion";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";

type WallTone = "fortified" | "at_risk" | "breached" | "open";

interface WatchAccount {
  id: string;
  site: string;
  identifier: string;
  label: string | null;
  status: string;
  last_checked_at: string | null;
  last_result: string;
  security_score: number;
  credential_enc?: boolean;
  mfa_enabled?: boolean;
  pwned_count?: number;
  strength_score?: number;
  password_set_at?: string | null;
  last_lockdown_at?: string | null;
  wall?: WallTone;
  created_at: string;
}

interface WallBreakdown {
  fortified?: number;
  at_risk?: number;
  breached?: number;
  open?: number;
}

interface Breach {
  id: string;
  account_id: string;
  source: string;
  type: string;
  indicator: string | null;
  headline: string;
  detail: string;
  severity: string;
  status: string;
  first_seen: string;
}

interface Lockdown {
  id: string;
  account_id: string;
  site: string;
  identifier: string;
  status: string;
  created_at: string;
  playbook: {
    title: string;
    steps: string[];
    links: [string, string][];
  } | null;
}

interface ShieldSummary {
  accounts: number;
  watched: number;
  openBreaches: number;
  totalBreaches: number;
  securityScore: number;
  status: string;
  walls: WallBreakdown;
  lockdowns: number;
}

interface CredentialStatus {
  fortified: boolean;
  password_set: boolean;
  password_strength: number;
  pwned_count: number;
  mfa_enabled: boolean;
  rotation_stale_days: number | null;
  wall: string;
  checked_at: string | null;
}

const SITE_ICONS: Record<string, typeof Mail> = {
  google: Globe,
  gmail: Mail,
  bank: Landmark,
  "credit-card": CreditCard,
  steam: Gamepad2,
  epic: Gamepad2,
  discord: Gamepad2,
  playstation: Gamepad2,
  xbox: Gamepad2,
  roblox: Gamepad2,
  nintendo: Gamepad2,
  twitter: Users,
  instagram: Mail,
  facebook: Users,
  paypal: Wallet,
  crypto: Wallet,
  work: Briefcase,
  other: Globe,
};

const WALL_META: Record<string, { label: string; cls: string; dot: string }> = {
  fortified: { label: "Fortified", cls: "bg-green/15 text-green border-green/30", dot: "bg-green" },
  at_risk: { label: "At risk", cls: "bg-amber/15 text-amber border-amber/30", dot: "bg-amber" },
  breached: { label: "Breached", cls: "bg-red/15 text-red border-red/30", dot: "bg-red" },
  open: { label: "Open wall", cls: "bg-cyan/15 text-cyan border-cyan/30", dot: "bg-cyan" },
};

const SEVERITY_META: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-red/15 text-red" },
  high: { label: "High", cls: "bg-red/10 text-red" },
  medium: { label: "Medium", cls: "bg-amber/15 text-amber" },
  low: { label: "Low", cls: "bg-cyan/15 text-cyan" },
};

function formatSite(site: string) {
  return site.replace(/-/g, " ");
}

export function AccountShieldView() {
  const { toast } = useApp();
  const [accounts, setAccounts] = useState<WatchAccount[]>([]);
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [lockdowns, setLockdowns] = useState<Lockdown[]>([]);
  const [summary, setSummary] = useState<ShieldSummary | null>(null);
  const [sites, setSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [site, setSite] = useState("google");
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");
  const [hardenId, setHardenId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [mfa, setMfa] = useState(true);
  const [hardeningId, setHardeningId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [accs, br, sum, sts, lds] = await Promise.all([
        api.getAccountShieldAccounts(),
        api.getAccountShieldBreaches(),
        api.getAccountShieldSummary(),
        api.getAccountShieldSites(),
        api.getAccountShieldLockdowns(),
      ]);
      setAccounts((accs as any)?.accounts || []);
      setBreaches((br as any)?.breaches || []);
      setSummary(sum);
      setSites((sts as any)?.sites || []);
      setLockdowns((lds as any)?.lockdowns || []);
    } catch (e: any) {
      toast({ title: "Could not load Account Shield", body: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openBreaches = useMemo(
    () => breaches.filter((b) => b.status !== "resolved"),
    [breaches],
  );

  const walls = summary?.walls || {};

  async function addAccount() {
    if (!identifier.trim()) {
      toast({ title: "Identifier required", body: "Enter an email or username to watch.", variant: "error" });
      return;
    }
    setAdding(true);
    try {
      await api.addAccountShieldAccount({
        site,
        identifier: identifier.trim(),
        label: label.trim() || undefined,
      });
      toast({ title: "Account behind the shield", body: `${formatSite(site)} is now monitored.`, variant: "success" });
      setShowForm(false);
      setIdentifier("");
      setLabel("");
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to add account", body: e.message, variant: "error" });
    } finally {
      setAdding(false);
    }
  }

  async function harden(id: string) {
    if (!password) {
      toast({ title: "Password required", body: "Set the credential you use for this account.", variant: "error" });
      return;
    }
    setHardeningId(id);
    try {
      const status: CredentialStatus = await api.setAccountShieldCredential(id, password, mfa);
      toast({
        title: status.fortified ? "Wall fortified" : "Wall partially reinforced",
        body: status.wall === "fortified"
          ? "Unique, strong password stored with MFA on."
          : "Keep hardening — run a scan and enable MFA.",
        variant: status.fortified ? "success" : "info",
      });
      setPassword("");
      setHardenId(null);
      await loadAll();
    } catch (e: any) {
      toast({ title: "Credential blocked", body: e.message, variant: "error" });
    } finally {
      setHardeningId(null);
    }
  }

  async function runScan(id: string) {
    setScanningId(id);
    try {
      const result = await api.scanAccountShieldAccount(id);
      toast({
        title: "Scan complete",
        body: `${(result as any)?.score ?? "?"}% score — ${(result as any)?.newFindings ?? 0} new finding(s)`,
        variant: (result as any)?.newFindings > 0 ? "error" : "success",
      });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Scan failed", body: e.message, variant: "error" });
    } finally {
      setScanningId(null);
    }
  }

  async function lockDown(id: string, siteLabel: string) {
    setLockingId(id);
    try {
      await api.lockdownAccountShieldAccount(id);
      toast({
        title: "Lockdown initiated",
        body: `Recovery playbook sent for ${siteLabel}.`,
        variant: "error",
      });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Lockdown failed", body: e.message, variant: "error" });
    } finally {
      setLockingId(null);
    }
  }

  async function removeAccount(id: string, siteLabel: string) {
    try {
      await api.removeAccountShieldAccount(id);
      toast({ title: "Account removed", body: `${siteLabel} is no longer behind the shield.` });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to remove", body: e.message, variant: "error" });
    }
  }

  async function resolveBreach(id: string) {
    try {
      await api.resolveAccountShieldBreach(id);
      toast({ title: "Finding marked resolved", variant: "success" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to resolve", body: e.message, variant: "error" });
    }
  }

  async function completeLockdown(id: string) {
    try {
      await api.completeAccountShieldLockdown(id);
      toast({ title: "Lockdown complete", body: "Re-harden this account to restore a fortified wall.", variant: "success" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to complete", body: e.message, variant: "error" });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 sm:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const score = summary?.securityScore ?? 100;
  const breachedCount = (walls.breached || 0) + (walls.at_risk || 0);

  return (
    <StaggerContainer className="mx-auto max-w-6xl space-y-6 p-6">
      <SectionHeader
        icon={ShieldCheck}
        title="Account Shield"
        description="A defensive wall around the accounts you care about. Weak, reused, or breached credentials are blocked at the gate; when a breach is found, the wall escalates into a lockdown playbook."
        action={
          !showForm && (
            <Button variant="cyan" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Add account
            </Button>
          )
        }
      />

      {/* Barrier status banner */}
      <Card className={cn(
        "border",
        breachedCount > 0 ? "border-red/30 bg-gradient-to-r from-red/10 to-transparent" : "border-green/20 bg-gradient-to-r from-green/10 to-transparent",
      )}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              breachedCount > 0 ? "bg-red/15 text-red" : "bg-green/15 text-green",
            )}>
              {breachedCount > 0 ? <Siren className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-display text-lg font-bold text-ink">
                {breachedCount > 0 ? "Breach incident active — lockdown recommended" : "Barrier standing"}
              </p>
              <p className="text-sm text-ink-muted">
                {breachedCount > 0
                  ? `${walls.breached || 0} breached and ${walls.at_risk || 0} at-risk accounts need your attention.`
                  : `${walls.fortified || 0} fortified · ${walls.at_risk || 0} at risk · ${walls.open || 0} open walls.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {breachedCount > 0 && (
              <Button variant="destructive" onClick={() => {
                const breached = accounts.find((a) => a.wall === "breached" || a.wall === "at_risk");
                if (breached) lockDown(breached.id, formatSite(breached.site));
              }}>
                <Siren className="h-4 w-4" /> Initiate lockdown
              </Button>
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-ink">Shield</span>
              <ProgressRing value={score} size={52} strokeWidth={6} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <BarrierStat label="Fortified" value={walls.fortified || 0} tone="green" />
        <BarrierStat label="At risk" value={walls.at_risk || 0} tone="amber" />
        <BarrierStat label="Breached" value={walls.breached || 0} tone="red" />
        <BarrierStat label="Open findings" value={openBreaches.length} tone="amber" />
        <BarrierStat label="Lockdowns" value={summary?.lockdowns ?? 0} tone="cyan" />
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="font-display text-lg font-bold text-ink">Watch a new account</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Account type</label>
                <select
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-sm text-ink outline-none focus:border-cyan/50"
                >
                  {sites.map((s) => (
                    <option key={s} value={s}>
                      {formatSite(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Email or username</label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cyan/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Label (optional)</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Main Google account"
                  className="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cyan/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addAccount} disabled={adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add account
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Watched accounts */}
      <div>
        <h3 className="mb-3 font-display text-xl font-bold text-ink">Defended accounts</h3>
        {accounts.length === 0 ? (
          <EmptyState
            icon={Lock}
            title="No accounts behind the shield yet"
            description="Add your Google, bank, Steam, or other accounts. The wall blocks weak and breached credentials and monitors the rest."
            action={
              <Button variant="cyan" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Add your first account
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => {
              const Icon = SITE_ICONS[acc.site] || Lock;
              const isScanning = scanningId === acc.id;
              const isLocking = lockingId === acc.id;
              const wallMeta = WALL_META[acc.wall || "open"] || WALL_META.open;
              const isHardening = hardenId === acc.id;
              const stale = acc.password_set_at &&
                (Date.now() - new Date(acc.password_set_at).getTime()) / 86400000 > 90;
              return (
                <Card key={acc.id} className={cn(
                  "group",
                  acc.wall === "breached" && "border-red/30",
                  acc.wall === "at_risk" && "border-amber/20",
                )}>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          acc.wall === "open" ? "bg-cyan/15 text-cyan" :
                            acc.wall === "breached" ? "bg-red/15 text-red" :
                              acc.wall === "at_risk" ? "bg-amber/15 text-amber" : "bg-green/15 text-green",
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-display text-sm font-bold text-ink">
                              {formatSite(acc.site)}
                              {acc.label ? <span className="text-ink-muted"> · {acc.label}</span> : null}
                            </p>
                            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", wallMeta.cls)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", wallMeta.dot)} />
                              {wallMeta.label}
                            </span>
                          </div>
                          <p className="font-mono text-xs text-ink-muted">{acc.identifier}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "font-mono text-lg font-bold",
                        acc.security_score >= 80 ? "text-green" : acc.security_score >= 50 ? "text-amber" : "text-red",
                      )}>
                        {acc.security_score}
                      </span>
                    </div>

                    {/* Defense checklist */}
                    <div className="flex flex-wrap gap-2">
                      <DefenseIcon ok={!!acc.credential_enc} okText="Credential vaulted" failText="No credential" icon={KeyRound} />
                      {acc.mfa_enabled ? (
                        <DefenseIcon ok okText="MFA on" failText="No MFA" icon={Fingerprint} />
                      ) : (
                        <DefenseIcon ok={false} okText="MFA on" failText="No MFA" icon={Fingerprint} />
                      )}
                      {acc.pwned_count != null && (acc.pwned_count ?? 0) > 0 ? (
                        <Badge variant="red">Pwned ×{acc.pwned_count}</Badge>
                      ) : acc.credential_enc ? (
                        <Badge variant="green">Not pwned</Badge>
                      ) : null}
                      {stale && <Badge variant="amber">Rotation stale</Badge>}
                    </div>

                    {acc.last_checked_at && (
                      <span className="block text-xs text-ink-faint">
                        Last scan {new Date(acc.last_checked_at).toLocaleDateString()}
                      </span>
                    )}

                    {/* Harden form */}
                    {isHardening && (
                      <div className="space-y-3 rounded-xl border border-white/10 bg-surface-0/60 p-3">
                        <p className="text-xs text-ink-muted">
                          The wall protects this account with a password that attackers already have — a unique, strong, still-secret one. It&apos;s encrypted on the server, never shown back to you.
                        </p>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password you use for this account"
                          className="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-green/50"
                        />
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
                          <input
                            type="checkbox"
                            checked={mfa}
                            onChange={(e) => setMfa(e.target.checked)}
                            className="h-3.5 w-3.5 accent-black"
                          />
                          Two-factor (2FA / 2SV) is enabled on this account
                        </label>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => harden(acc.id)} disabled={hardeningId === acc.id}>
                            {hardeningId === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                            Vault credential
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setHardenId(null); setPassword(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {!acc.credential_enc && (
                        <Button size="sm" variant="outline" onClick={() => { setHardenId(acc.id); setMfa(true); }}>
                          <KeyRound className="h-3.5 w-3.5" /> Harden
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => runScan(acc.id)} disabled={isScanning}>
                        {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
                        {isScanning ? "Scanning…" : "Scan"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => lockDown(acc.id, formatSite(acc.site))} disabled={isLocking}>
                        {isLocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Siren className="h-3.5 w-3.5" />}
                        Lockdown
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeAccount(acc.id, formatSite(acc.site))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Lockdown playbooks */}
      {lockdowns.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-xl font-bold text-ink">Lockdown playbooks</h3>
          <div className="space-y-3">
            {lockdowns.map((ld) => (
              <Card key={ld.id} className={cn(ld.status === "completed" && "opacity-50")}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/15 text-red">
                        <Siren className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-ink">
                          {ld.playbook?.title || `${formatSite(ld.site)} lockdown`}
                        </p>
                        <p className="font-mono text-xs text-ink-muted">
                          {ld.identifier} · {new Date(ld.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={ld.status === "active" ? "red" : "muted"}>
                      {ld.status === "active" ? "Active" : "Completed"}
                    </Badge>
                  </div>
                  {ld.playbook && (
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
                      {ld.playbook.steps.map((step, i) => (
                        <li key={i} className="text-ink-muted">{step}</li>
                      ))}
                    </ol>
                  )}
                  {ld.playbook?.links && (
                    <div className="flex flex-wrap gap-2">
                      {ld.playbook.links.map(([label, href]) => (
                        <a
                          key={href}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-white/10 bg-surface-1 px-3 py-1.5 text-xs text-green transition-colors hover:border-green/40"
                        >
                          {label}
                        </a>
                      ))}
                    </div>
                  )}
                  {ld.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => completeLockdown(ld.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Breach findings */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-ink">Findings</h3>
          <Button size="sm" variant="ghost" onClick={loadAll} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {breaches.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No findings yet"
            description="Run a scan on your defended accounts. We search dark-web, paste, and leak-adjacent sources for your identifiers."
            action={
              accounts[0] ? (
                <Button variant="cyan" onClick={() => runScan(accounts[0].id)}>
                  <Search className="h-4 w-4" /> Run a scan
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {breaches.map((b) => {
              const meta = SEVERITY_META[b.severity] || SEVERITY_META.medium;
              const resolved = b.status === "resolved";
              return (
                <Card key={b.id} className={cn(resolved && "opacity-50")}>
                  <CardContent className="flex items-start justify-between gap-4 pt-6">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", meta.cls)}>
                          {meta.label}
                        </span>
                        <Badge variant={resolved ? "muted" : "red"}>
                          {resolved ? "Resolved" : "Open"}
                        </Badge>
                        <span className="font-mono text-xs text-ink-faint">{b.source}</span>
                      </div>
                      <p className="font-display text-sm font-bold text-ink">{b.headline}</p>
                      <p className="text-sm text-ink-muted">{b.detail}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {!resolved && (
                        <Button size="sm" variant="outline" onClick={() => resolveBreach(b.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </StaggerContainer>
  );
}

function BarrierStat({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" | "cyan" }) {
  const tones: Record<string, { text: string; bg: string }> = {
    green: { text: "text-green", bg: "bg-green/15" },
    amber: { text: "text-amber", bg: "bg-amber/15" },
    red: { text: "text-red", bg: "bg-red/15" },
    cyan: { text: "text-cyan", bg: "bg-cyan/15" },
  };
  const t = tones[tone];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-surface-1/60 p-4">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", t.bg, t.text)}>
        <span className="text-sm font-bold">{value}</span>
      </div>
      <p className="text-sm text-ink-muted">{label}</p>
    </div>
  );
}

function DefenseIcon({ ok, okText, failText, icon: Icon }: {
  ok: boolean;
  okText: string;
  failText: string;
  icon: typeof Lock;
}) {
  return ok ? (
    <Badge variant="green"><Icon className="h-3 w-3" /> {okText}</Badge>
  ) : (
    <Badge variant="muted"><Icon className="h-3 w-3" /> {failText}</Badge>
  );
}