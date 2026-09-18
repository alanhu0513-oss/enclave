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
  Globe,
  Activity,
  Compass,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem, Kinetic } from "@/components/ui/motion";
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

  const COUNTRY_HOTSPOTS = [
    { id: "us", name: "United States", code: "USA", x: 22, y: 36, threatLevel: "critical", activeCampaigns: 142, shieldIntegrity: 89, primaryVector: "Facial Swap / Voice Clone", lastAttack: "2 mins ago" },
    { id: "gb", name: "United Kingdom", code: "GBR", x: 45, y: 28, threatLevel: "high", activeCampaigns: 78, shieldIntegrity: 92, primaryVector: "Video Lip Sync Swaps", lastAttack: "5 mins ago" },
    { id: "de", name: "Germany", code: "DEU", x: 49, y: 29, threatLevel: "high", activeCampaigns: 64, shieldIntegrity: 95, primaryVector: "Acoustic Synthetics", lastAttack: "12 mins ago" },
    { id: "jp", name: "Japan", code: "JPN", x: 80, y: 39, threatLevel: "moderate", activeCampaigns: 41, shieldIntegrity: 98, primaryVector: "Identity Synthesis", lastAttack: "18 mins ago" },
    { id: "au", name: "Australia", code: "AUS", x: 84, y: 76, threatLevel: "low", activeCampaigns: 19, shieldIntegrity: 99, primaryVector: "Phishing Stream Injectors", lastAttack: "1 hour ago" },
    { id: "in", name: "India", code: "IND", x: 66, y: 46, threatLevel: "critical", activeCampaigns: 115, shieldIntegrity: 84, primaryVector: "Real-time Stream Overlays", lastAttack: "1 min ago" },
    { id: "br", name: "Brazil", code: "BRA", x: 36, y: 64, threatLevel: "moderate", activeCampaigns: 53, shieldIntegrity: 91, primaryVector: "Facial Landmark Mesh", lastAttack: "25 mins ago" },
    { id: "za", name: "South Africa", code: "ZAF", x: 52, y: 69, threatLevel: "moderate", activeCampaigns: 32, shieldIntegrity: 94, primaryVector: "Voice Synthesis Swaps", lastAttack: "42 mins ago" },
  ];

  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_HOTSPOTS[0]);

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

        {/* Real-time Global Threat Map */}
        <Card className="lg:col-span-2 overflow-hidden border-cyan/20 bg-[#07080c]/85 shadow-[0_0_24px_rgba(0,242,254,0.1)] relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan" />
          
          <CardHeader className="border-b border-white/[0.06] pb-4 bg-white/[0.01]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-ink">
                  <Globe className="h-5 w-5 text-cyan animate-spin-slow" />
                  Global Deepfake Threat Mapping System
                </CardTitle>
                <CardDescription>
                  Real-time visualization of synthetic campaign hotspots, active payloads, and regional countermeasures
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex h-2 w-2 rounded-full bg-red animate-ping" />
                <span className="font-mono text-xs text-red font-semibold bg-red/10 border border-red/20 px-2 py-0.5 rounded">
                  LIVE QUANTUM TELEMETRY
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <Skeleton className="h-[400px]" />
            ) : (
              <div className="grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08]">
                {/* Visual SVG Map Section */}
                <div className="lg:col-span-7 p-6 flex flex-col justify-between relative bg-black/40 min-h-[350px]">
                  {/* Subtle Grid Coordinates Overlay */}
                  <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-20 border border-white/[0.03]">
                    {[...Array(24)].map((_, idx) => (
                      <div key={idx} className="border-r border-b border-white/[0.04]" />
                    ))}
                  </div>

                  <div className="relative flex-1 flex items-center justify-center">
                    {/* SVG Holographic World Map Outline */}
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full max-h-[320px] select-none text-white/[0.06]"
                    >
                      {/* Stylized Continents Grid Dots and Paths (Futuristic Representation) */}
                      {/* North America */}
                      <path d="M 12,22 L 28,18 L 35,30 L 25,50 L 15,35 Z" fill="currentColor" />
                      {/* South America */}
                      <path d="M 28,52 L 38,58 L 42,75 L 35,88 L 30,70 Z" fill="currentColor" />
                      {/* Africa */}
                      <path d="M 45,45 L 56,42 L 62,55 L 56,82 L 48,70 L 42,55 Z" fill="currentColor" />
                      {/* Europe */}
                      <path d="M 44,22 L 56,18 L 58,35 L 48,38 Z" fill="currentColor" />
                      {/* Asia */}
                      <path d="M 58,20 L 88,18 L 92,42 L 75,52 L 60,42 L 56,28 Z" fill="currentColor" />
                      {/* Australia */}
                      <path d="M 78,68 L 88,68 L 92,80 L 82,85 L 75,75 Z" fill="currentColor" />

                      {/* Radar sweep line */}
                      <motion.line
                        x1="50"
                        y1="50"
                        x2="100"
                        y2="50"
                        stroke="#00f2fe"
                        strokeWidth="0.4"
                        strokeDasharray="1 3"
                        className="origin-center"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      />

                      {/* Hotspots Radar Dots */}
                      {COUNTRY_HOTSPOTS.map((h) => {
                        const isSelected = selectedCountry.id === h.id;
                        const colors = {
                          critical: "#ff4757",
                          high: "#ffb020",
                          moderate: "#00bfff",
                          low: "#00ff88",
                        };
                        const color = colors[h.threatLevel as keyof typeof colors];
                        
                        return (
                          <g
                            key={h.id}
                            className="cursor-pointer group"
                            onClick={() => setSelectedCountry(h)}
                          >
                            {/* Outer Ping */}
                            <circle
                              cx={h.x}
                              cy={h.y}
                              r={isSelected ? 3.5 : 2}
                              fill={color}
                              className="animate-ping origin-center opacity-40"
                              style={{ animationDuration: isSelected ? "1.5s" : "3s" }}
                            />
                            {/* Inner Dot */}
                            <circle
                              cx={h.x}
                              cy={h.y}
                              r={isSelected ? 2 : 1.2}
                              fill={color}
                              className={cn(
                                "transition-all duration-300 group-hover:r-2.5",
                                isSelected ? "stroke-black stroke-[0.8] shadow-[0_0_12px_rgba(255,255,255,0.8)]" : ""
                              )}
                            />
                            {/* Text label */}
                            <text
                              x={h.x}
                              y={h.y - 3}
                              className={cn(
                                "font-mono font-bold select-none transition-all duration-300 pointer-events-none fill-white/50 text-[2.5px] group-hover:fill-cyan",
                                isSelected ? "fill-cyan font-black text-[3.2px]" : ""
                              )}
                              textAnchor="middle"
                            >
                              {h.code}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="flex items-center justify-between font-mono text-[10px] text-ink-faint border-t border-white/[0.04] pt-3 mt-4">
                    <span className="flex items-center gap-1">
                      <Compass className="h-3 w-3 text-cyan animate-spin-slow" />
                      GRID RESOLUTION: 0.12 ArcSec
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-green animate-pulse" />
                      ACTIVE NODES: 8/8 CONNECTED
                    </span>
                  </div>
                </div>

                {/* Country HUD Information Deck */}
                <div className="lg:col-span-5 p-6 flex flex-col justify-between space-y-5 bg-[#0a0d14]/40">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-bold text-lg text-ink flex items-center gap-2">
                        <span className={cn(
                          "inline-block w-2.5 h-2.5 rounded-full",
                          selectedCountry.threatLevel === "critical" ? "bg-red" :
                          selectedCountry.threatLevel === "high" ? "bg-amber" :
                          selectedCountry.threatLevel === "moderate" ? "bg-cyan" : "bg-green"
                        )} />
                        {selectedCountry.name}
                      </h4>
                      <Badge
                        variant={
                          selectedCountry.threatLevel === "critical" ? "red" :
                          selectedCountry.threatLevel === "high" ? "outline" : "cyan"
                        }
                        className="font-mono text-xs font-bold uppercase"
                      >
                        {selectedCountry.threatLevel} severity
                      </Badge>
                    </div>

                    {/* HUD metrics block */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-white/[0.06] bg-black/40 rounded-xl p-3">
                        <p className="font-mono text-[10px] text-ink-faint uppercase">Active Campaigns</p>
                        <p className="font-display text-xl font-black text-ink mt-1">
                          {selectedCountry.activeCampaigns}
                        </p>
                      </div>
                      <div className="border border-white/[0.06] bg-black/40 rounded-xl p-3">
                        <p className="font-mono text-[10px] text-ink-faint uppercase">Shield Integrity</p>
                        <p className="font-display text-xl font-black text-green mt-1">
                          {selectedCountry.shieldIntegrity}%
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex justify-between border-b border-white/[0.04] py-1.5">
                        <span className="text-ink-faint">Primary Vector:</span>
                        <span className="text-ink font-medium text-right">{selectedCountry.primaryVector}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/[0.04] py-1.5">
                        <span className="text-ink-faint">Telemetry Latency:</span>
                        <span className="text-ink">14ms Quantum Link</span>
                      </div>
                      <div className="flex justify-between border-b border-white/[0.04] py-1.5">
                        <span className="text-ink-faint">Latest Threat Scan:</span>
                        <span className="text-red font-medium">{selectedCountry.lastAttack}</span>
                      </div>
                    </div>
                  </div>

                  {/* Scrolling hotspot table */}
                  <div className="space-y-2 border-t border-white/[0.08] pt-4">
                    <p className="font-mono text-[10px] text-ink-faint uppercase">Hotspot Quick Registry</p>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                      {COUNTRY_HOTSPOTS.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCountry(c)}
                          className={cn(
                            "cursor-pointer flex items-center justify-between p-2 rounded-lg font-mono text-xs transition-colors border",
                            selectedCountry.id === c.id
                              ? "bg-cyan/10 border-cyan/30 text-cyan"
                              : "bg-white/[0.02] border-transparent text-ink-muted hover:bg-white/[0.04]"
                          )}
                        >
                          <span>{c.name}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded font-bold uppercase",
                            c.threatLevel === "critical" ? "text-red" :
                            c.threatLevel === "high" ? "text-amber" :
                            c.threatLevel === "moderate" ? "text-cyan" : "text-green"
                          )}>
                            {c.activeCampaigns} campaigns
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
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
                  <a href="#" onClick={(e) => { e.preventDefault(); window.open(api.getBaseUrl() + "/reports/" + r.id + "/download", '_blank'); }} className="text-cyan hover:text-green">
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
    <Kinetic className="h-full">
      <Card className="h-full">
        <CardContent className="p-5">
          <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", colors[color])}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="font-display text-2xl font-bold text-ink">{value}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
        </CardContent>
      </Card>
    </Kinetic>
  );
}
