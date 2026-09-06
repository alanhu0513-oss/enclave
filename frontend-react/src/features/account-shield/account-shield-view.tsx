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
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader, StatCard, EmptyState } from "@/components/ui/dashboard";
import { StaggerContainer } from "@/components/ui/motion";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";

interface WatchAccount {
  id: string;
  site: string;
  identifier: string;
  label: string | null;
  status: string;
  last_checked_at: string | null;
  last_result: string;
  security_score: number;
  created_at: string;
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

interface ShieldSummary {
  accounts: number;
  watched: number;
  openBreaches: number;
  totalBreaches: number;
  securityScore: number;
  status: string;
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
  const [summary, setSummary] = useState<ShieldSummary | null>(null);
  const [sites, setSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [site, setSite] = useState("google");
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [accs, br, sum, sts] = await Promise.all([
        api.getAccountShieldAccounts(),
        api.getAccountShieldBreaches(),
        api.getAccountShieldSummary(),
        api.getAccountShieldSites(),
      ]);
      setAccounts((accs as any)?.accounts || []);
      setBreaches((br as any)?.breaches || []);
      setSummary(sum);
      setSites((sts as any)?.sites || []);
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
      toast({ title: "Account added", body: `${formatSite(site)} is now monitored.`, variant: "success" });
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

  async function runScan(id: string) {
    setScanningId(id);
    try {
      const result = await api.scanAccountShieldAccount(id);
      toast({
        title: "Scan complete",
        body: `${(result as any)?.score ?? "?"}% security score — ${(result as any)?.newFindings ?? 0} new finding(s)`,
        variant: (result as any)?.newFindings > 0 ? "error" : "success",
      });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Scan failed", body: e.message, variant: "error" });
    } finally {
      setScanningId(null);
    }
  }

  async function removeAccount(id: string, siteLabel: string) {
    try {
      await api.removeAccountShieldAccount(id);
      toast({ title: "Account removed", body: `${siteLabel} is no longer monitored.` });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to remove", body: e.message, variant: "error" });
    }
  }

  async function resolveBreach(id: string) {
    try {
      await api.resolveAccountShieldBreach(id);
      toast({ title: "Breach marked resolved", variant: "success" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to resolve", body: e.message, variant: "error" });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const score = summary?.securityScore ?? 100;

  return (
    <StaggerContainer className="mx-auto max-w-6xl space-y-6 p-6">
      <SectionHeader
        icon={ShieldCheck}
        title="Account Shield"
        description="Watch your Google, banking, and gaming accounts against hackers, credential leaks, and dark-web exposure."
        action={
          !showForm && (
            <Button variant="cyan" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Add account
            </Button>
          )
        }
      />

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-ink-muted">Security score</p>
              <p className="text-3xl font-bold text-ink">{score}</p>
            </div>
            <ProgressRing value={score} size={64} strokeWidth={6} />
          </CardContent>
        </Card>
        <StatCard icon={Lock} label="Watched accounts" value={summary?.watched ?? 0} color="cyan" />
        <StatCard icon={AlertTriangle} label="Open findings" value={openBreaches.length} color={openBreaches.length ? "red" : "green"} />
        <StatCard icon={ScanSearch} label="Total scans tracked" value={0} color="purple" />
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
              <Button onClick={addAccount} disabled={adding} variant="default">
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
        <h3 className="mb-3 font-display text-xl font-bold text-ink">Watched accounts</h3>
        {accounts.length === 0 ? (
          <EmptyState
            icon={Lock}
            title="No accounts watched yet"
            description="Add your Google, bank, Steam, or other accounts to start monitoring them against hackers and credential leaks."
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
              return (
                <Card key={acc.id} className="group">
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          acc.last_result === "issues_found" || acc.security_score < 80
                            ? "bg-red/15 text-red"
                            : "bg-green/15 text-green",
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-display text-sm font-bold text-ink">
                            {formatSite(acc.site)}
                            {acc.label ? <span className="text-ink-muted"> · {acc.label}</span> : null}
                          </p>
                          <p className="font-mono text-xs text-ink-muted">{acc.identifier}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "font-mono text-lg font-bold",
                          acc.security_score >= 80 ? "text-green" : acc.security_score >= 50 ? "text-amber" : "text-red",
                        )}>
                          {acc.security_score}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {acc.last_result === "issues_found" ? (
                        <Badge variant="red">Issues found</Badge>
                      ) : acc.last_result === "clean" ? (
                        <Badge variant="green">Clean</Badge>
                      ) : (
                        <Badge variant="muted">Pending scan</Badge>
                      )}
                      {acc.last_checked_at && (
                        <span className="text-xs text-ink-faint">
                          Last check {new Date(acc.last_checked_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runScan(acc.id)}
                        disabled={isScanning}
                      >
                        {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
                        {isScanning ? "Scanning…" : "Run scan"}
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
            description="Run a scan on your watched accounts. We search dark-web, paste, and leak-adjacent sources for your identifiers."
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