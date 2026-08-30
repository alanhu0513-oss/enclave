import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Server,
  Brain,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export function AdminDashboard() {
  const { toast } = useApp();
  const [overview, setOverview] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "health">("overview");

  async function load() {
    try {
      const [ov, rev, hl, al, us] = await Promise.all([
        api.request("/admin/overview").then((r: any) => r.data || r),
        api.request("/admin/revenue").then((r: any) => r.data || r),
        api.request("/admin/health").then((r: any) => r.data || r),
        api.request("/admin/alerts").then((r: any) => r.data || r),
        api.request("/admin/users?limit=20").then((r: any) => r.data?.users || r.users || []),
      ]);
      setOverview(ov);
      setRevenue(rev);
      setHealth(hl);
      setAlerts(al);
      setUsers(Array.isArray(us) ? us : []);
    } catch (e: any) {
      toast({ title: "Failed to load admin data", body: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cyan" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple/15 text-purple">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Admin Dashboard</h2>
          <p className="text-sm text-ink-muted">System overview and management</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["overview", "users", "health"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors",
              activeTab === tab ? "bg-cyan/15 text-cyan" : "bg-white/[0.04] text-ink-muted hover:text-ink"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-ink">{overview?.totalUsers || 0}</p>
                  <p className="text-xs text-ink-muted">Total Users</p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/15 text-green">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-ink">{revenue?.mrrFormatted || "$0"}</p>
                  <p className="text-xs text-ink-muted">Monthly Revenue</p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/15 text-amber">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-ink">{alerts?.total || 0}</p>
                  <p className="text-xs text-ink-muted">Total Alerts</p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/15 text-purple">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-ink">{overview?.newUsersToday || 0}</p>
                  <p className="text-xs text-ink-muted">New Today</p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>
      )}

      {/* Revenue breakdown */}
      {activeTab === "overview" && revenue && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Users by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(revenue.planDistribution || {}).map(([plan, count]) => (
                <div key={plan} className="rounded-xl bg-white/[0.03] p-4 text-center">
                  <p className="font-display text-2xl font-bold text-ink">{count as number}</p>
                  <p className="mt-1 text-xs font-medium capitalize text-ink-muted">{plan.replace("_", " ")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users */}
      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold text-ink">
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{u.name || "Unnamed"}</p>
                      <p className="text-xs text-ink-muted">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-[10px]", u.plan === "free" ? "bg-white/10 text-ink-muted" : "bg-cyan/15 text-cyan")}>
                      {u.plan}
                    </Badge>
                    <Badge className={cn("text-[10px]", u.role === "admin" ? "bg-purple/15 text-purple" : "bg-white/10 text-ink-muted")}>
                      {u.role}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health */}
      {activeTab === "health" && health && (
        <StaggerContainer className="grid gap-4 sm:grid-cols-2">
          <StaggerItem>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-cyan" />
                  <CardTitle>Server</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Status</span>
                  <Badge className="bg-green/15 text-green">Healthy</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Uptime</span>
                  <span className="text-ink">{health.server?.uptimeFormatted}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Heap Used</span>
                  <span className="text-ink">{health.server?.memory?.heapUsed}MB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">RSS</span>
                  <span className="text-ink">{health.server?.memory?.rss}MB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Node</span>
                  <span className="text-ink">{health.nodeVersion}</span>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple" />
                  <CardTitle>ML Service</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Status</span>
                  <Badge className={health.ml?.available ? "bg-green/15 text-green" : "bg-amber/15 text-amber"}>
                    {health.ml?.available ? "Available" : "Unavailable"}
                  </Badge>
                </div>
                {health.ml?.provider && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Provider</span>
                    <span className="text-ink">{health.ml.provider}</span>
                  </div>
                )}
                {health.ml?.model && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Model</span>
                    <span className="text-ink">{health.ml.model}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>
      )}
    </div>
  );
}
