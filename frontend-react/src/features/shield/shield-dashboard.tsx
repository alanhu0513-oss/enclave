import { useEffect, useState } from "react";
import {
  Shield,
  Globe,
  MessageSquare,
  AlertTriangle,
  Eye,
  Loader2,
  Lock,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

interface DarkWebAlert {
  id: string;
  source: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  url?: string;
  detectedAt: string;
  status: string;
}

export function ShieldDashboard() {
  const { toast } = useApp();
  const [alerts, setAlerts] = useState<DarkWebAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState({ totalSources: 0, activeSources: 0, criticalAlerts: 0, lastScan: "" });

  async function load() {
    try {
      const [statusData, alertData] = await Promise.all([
        api.getMonitoringStatus(),
        api.getAlerts(),
      ]);
      const status = statusData || {};
      const alertList = Array.isArray(alertData) ? alertData : [];
      setAlerts(alertList.filter((a: any) => ["dark_web", "forums", "telegram"].includes(a.type)) as DarkWebAlert[]);
      setStats({
        totalSources: 6,
        activeSources: status?.sources?.length || 4,
        criticalAlerts: alertList.filter((a: any) => a.severity === "critical").length,
        lastScan: new Date().toISOString(),
      });
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function runScan() {
    setScanning(true);
    try {
      await api.deepScan();
      toast({ title: "Dark web scan started", variant: "success" });
      setTimeout(load, 3000);
    } catch (e: any) {
      toast({ title: "Scan failed", body: e.message, variant: "error" });
    } finally { setScanning(false); }
  }

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "red";
      case "high": return "amber";
      case "medium": return "amber";
      default: return "green";
    }
  };

  const sourceIcon = (t: string) => {
    switch (t) {
      case "dark_web": return <Lock className="h-4 w-4" />;
      case "forums": return <MessageSquare className="h-4 w-4" />;
      case "telegram": return <Globe className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple/15 text-purple">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Shield Dashboard</h1>
            <p className="text-sm text-ink-muted">Dark web monitoring & deep source protection</p>
          </div>
        </div>
        <Button variant="cyan" onClick={runScan} disabled={scanning}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run Deep Scan
        </Button>
      </div>

      <StaggerContainer className="grid gap-4 sm:grid-cols-4">
        <StaggerItem>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple/15 text-purple">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{stats.activeSources}</p>
                <p className="text-sm text-ink-muted">Active Sources</p>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red/15 text-red">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{stats.criticalAlerts}</p>
                <p className="text-sm text-ink-muted">Critical Alerts</p>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{stats.totalSources}</p>
                <p className="text-sm text-ink-muted">Monitored Sources</p>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green/15 text-green">
                <Eye className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{alerts.length}</p>
                <p className="text-sm text-ink-muted">Dark Web Findings</p>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monitored Sources</CardTitle>
            <CardDescription>Dark web & deep monitoring sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "Ahmia (Tor)", type: "dark_web", status: "active", findings: 2 },
              { name: "Security Forums", type: "forums", status: "active", findings: 0 },
              { name: "Telegram Channels", type: "telegram", status: "active", findings: 1 },
              { name: "Paste Sites", type: "paste", status: "active", findings: 3 },
              { name: "DuckDuckGo Dark", type: "dark_web", status: "active", findings: 0 },
              { name: "Tor Proxy", type: "dark_web", status: "pending", findings: 0 },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple/15 text-purple">
                  {sourceIcon(s.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-ink-muted">{s.type.replace("_", " ")}</p>
                </div>
                <Badge variant={s.status === "active" ? "green" : "amber"}>
                  {s.status === "active" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  {s.status}
                </Badge>
                <span className="text-sm font-mono text-ink-muted">{s.findings} findings</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Dark Web Alerts</CardTitle>
            <CardDescription>Findings from dark web monitoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-ink-muted">
                <Shield className="h-10 w-10 text-ink-faint" />
                <p>No dark web findings yet. Your identity is safe.</p>
              </div>
            ) : (
              alerts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", `bg-${severityColor(a.severity)}/15 text-${severityColor(a.severity)}`)}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{a.title}</p>
                    <p className="truncate text-xs text-ink-muted">{a.source} · {new Date(a.detectedAt).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={severityColor(a.severity) as any}>{a.severity}</Badge>
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-cyan hover:text-cyan/80">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
