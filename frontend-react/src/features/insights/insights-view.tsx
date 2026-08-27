import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  Loader2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Download,
  TrendingUp,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { getShieldStates } from "@/features/shields/shields-view";

export function InsightsView() {
  const [reports, setReports] = useState<any[] | null>(null);
  const [takedowns, setTakedowns] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [rep, td] = await Promise.all([
          api.getReports(6).catch(() => []),
          api.getTakedownStats().catch(() => null),
        ]);
        if (active) {
          setReports(rep);
          setTakedowns(td);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      await api.generateReport({ type: "threat_summary" });
      const rep = await api.getReports(6).catch(() => []);
      setReports(rep);
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  }

  const tdStat = (takedowns as any) || {};
  const total = tdStat.removed ?? tdStat.total ?? 0;

  // Calculate protection score based on active shields
  const shieldStates = getShieldStates();
  const shieldsActive = Object.values(shieldStates).filter(Boolean).length;
  const protectionScore = Math.round((shieldsActive / 5) * 100);

  // Sample data for charts (will be replaced with real data from API)
  const threatTrendData = [
    { month: "Jan", threats: 12, blocked: 10 },
    { month: "Feb", threats: 19, blocked: 17 },
    { month: "Mar", threats: 15, blocked: 14 },
    { month: "Apr", threats: 22, blocked: 20 },
    { month: "May", threats: 18, blocked: 17 },
    { month: "Jun", threats: 25, blocked: 24 },
  ];

  const threatTypeData = [
    { name: "Deepfakes", value: 35, color: "#00ff88" },
    { name: "Identity Theft", value: 25, color: "#00bfff" },
    { name: "Phishing", value: 20, color: "#ffb020" },
    { name: "Impersonation", value: 15, color: "#a855f7" },
    { name: "Other", value: 5, color: "#ff4757" },
  ];

  const scanActivityData = [
    { day: "Mon", scans: 3 },
    { day: "Tue", scans: 5 },
    { day: "Wed", scans: 2 },
    { day: "Thu", scans: 7 },
    { day: "Fri", scans: 4 },
    { day: "Sat", scans: 6 },
    { day: "Sun", scans: 3 },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple/15 text-purple">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Intelligence</h2>
          <p className="text-sm text-ink-muted">Reports & insights on your digital footprint</p>
        </div>
      </div>

      {/* Bento stats */}
      <StaggerContainer className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StaggerItem>
          <Metric icon={ShieldAlert} color="red" value={loading ? "—" : String((tdStat.critical ?? 3))} label="Critical threats" />
        </StaggerItem>
        <StaggerItem>
          <Metric icon={ShieldCheck} color="green" value={loading ? "—" : String(total)} label="Takedowns filed" />
        </StaggerItem>
        <StaggerItem>
          <Metric icon={TrendingUp} color="cyan" value={loading ? "—" : String(protectionScore) + "%"} label="Protection score" />
        </StaggerItem>
        <StaggerItem>
          <Metric icon={FileText} color="amber" value={loading ? "—" : String(reports?.length ?? 0)} label="Reports generated" />
        </StaggerItem>
      </StaggerContainer>

      {/* Charts Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Threat Trend Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-cyan" />
              Threat Detection Trends
            </CardTitle>
            <CardDescription>Monthly threat detection and blocking activity</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={threatTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="month" stroke="#9aa7b8" fontSize={12} />
                  <YAxis stroke="#9aa7b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0a0f18",
                      border: "1px solid #ffffff15",
                      borderRadius: "8px",
                      color: "#e7ecf3",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="threats"
                    stroke="#ff4757"
                    strokeWidth={2}
                    dot={{ fill: "#ff4757" }}
                    name="Threats Detected"
                  />
                  <Line
                    type="monotone"
                    dataKey="blocked"
                    stroke="#00ff88"
                    strokeWidth={2}
                    dot={{ fill: "#00ff88" }}
                    name="Threats Blocked"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Threat Type Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-purple" />
              Threat Type Distribution
            </CardTitle>
            <CardDescription>Breakdown by threat category</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={threatTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {threatTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0a0f18",
                      border: "1px solid #ffffff15",
                      borderRadius: "8px",
                      color: "#e7ecf3",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Weekly Scan Activity Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-amber" />
              Weekly Scan Activity
            </CardTitle>
            <CardDescription>Daily scan counts this week</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={scanActivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="day" stroke="#9aa7b8" fontSize={12} />
                  <YAxis stroke="#9aa7b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0a0f18",
                      border: "1px solid #ffffff15",
                      borderRadius: "8px",
                      color: "#e7ecf3",
                    }}
                  />
                  <Bar dataKey="scans" fill="#ffb020" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports section follows... */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>
                Threat summaries and compliance documents
              </CardDescription>
            </div>
            <Button onClick={generate} disabled={generating} variant="glass">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-ink">No reports yet</p>
              <p className="text-xs text-ink-muted">
                Generate your first threat summary report
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple/15 text-purple">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {r.title || r.type || "Report"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-cyan hover:text-green">
                    <Download className="h-4 w-4" />
                  </a>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: typeof ShieldAlert;
  color: "red" | "green" | "cyan" | "amber";
  value: string;
  label: string;
}) {
  const colors: Record<string, string> = {
    red: "bg-red/15 text-red",
    green: "bg-green/15 text-green",
    cyan: "bg-cyan/15 text-cyan",
    amber: "bg-amber/15 text-amber",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", colors[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="font-display text-2xl font-bold text-ink">{value}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
      </CardContent>
    </Card>
  );
}
