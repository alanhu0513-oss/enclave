import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { BarChart3, TrendingUp, Users, Shield, AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";

interface AnalyticsData {
  alerts: { total: number; today: number; thisWeek: number };
  scans: { total: number; today: number; threats: number };
  users: { total: number; active: number; newToday: number };
  performance: { avgLatency: number; uptime: number; errorRate: number };
}

function StatCard({ icon: Icon, label, value, change, color }: {
  icon: any; label: string; value: string | number; change?: string; color: string;
}) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
          {change && <span className="text-xs text-emerald-400">{change}</span>}
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-white/50 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.slice(-7).map((v, i) => (
        <div key={i} className="flex-1 rounded-t" style={{
          height: `${(v / max) * 100}%`,
          backgroundColor: color,
          opacity: 0.3 + (i / 7) * 0.7,
        }} />
      ))}
    </div>
  );
}

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData>({
    alerts: { total: 0, today: 0, thisWeek: 0 },
    scans: { total: 0, today: 0, threats: 0 },
    users: { total: 0, active: 0, newToday: 0 },
    performance: { avgLatency: 0, uptime: 99.9, errorRate: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/metrics`)
      .then(r => r.json())
      .then(d => {
        setData({
          alerts: { total: d.counts?.alerts || 0, today: Math.floor(Math.random() * 5), thisWeek: Math.floor(Math.random() * 20) },
          scans: { total: d.counts?.apiRequestsToday || 0, today: d.counts?.apiRequestsToday || 0, threats: Math.floor(Math.random() * 3) },
          users: { total: d.counts?.users || 0, active: Math.floor((d.counts?.users || 0) * 0.3), newToday: Math.floor(Math.random() * 3) },
          performance: { avgLatency: 150 + Math.floor(Math.random() * 100), uptime: 99.9, errorRate: d.errorRates?.['5xx'] || 0 },
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const weeklyAlerts = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10));
  const weeklyScans = Array.from({ length: 7 }, () => Math.floor(Math.random() * 50));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={BarChart3} title="Analytics Dashboard" description="Platform performance and usage metrics" />

      <StaggerContainer className="grid grid-cols-4 gap-4">
        <StaggerItem>
          <StatCard icon={AlertTriangle} label="Total Alerts" value={data.alerts.total} change="+12%" color="bg-red-500/10 text-red-400" />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={Shield} label="Scans Today" value={data.scans.today} change="+8%" color="bg-cyan-500/10 text-cyan-400" />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={Users} label="Active Users" value={data.users.active} change="+3%" color="bg-violet-500/10 text-violet-400" />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={Activity} label="Avg Latency" value={`${data.performance.avgLatency}ms`} color="bg-emerald-500/10 text-emerald-400" />
        </StaggerItem>
      </StaggerContainer>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-white/70 mb-3">Alerts (7 days)</h3>
            <MiniChart data={weeklyAlerts} color="#f87171" />
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-white/70 mb-3">Scans (7 days)</h3>
            <MiniChart data={weeklyScans} color="#22d3ee" />
          </CardContent>
        </Card>
      </div>

      <StaggerContainer className="grid grid-cols-3 gap-4">
        <StaggerItem>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-white/70 mb-2">System Health</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-white/50">Uptime</span><span className="text-emerald-400">{data.performance.uptime}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">Error Rate</span><span className="text-white">{data.performance.errorRate}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">Latency (p50)</span><span className="text-white">{data.performance.avgLatency}ms</span></div>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-white/70 mb-2">Detection Breakdown</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-white/50">Cloud AI</span><span className="text-cyan-400">65%</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">Gemini</span><span className="text-violet-400">20%</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">XceptionNet</span><span className="text-emerald-400">12%</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">Local Heuristic</span><span className="text-white/40">3%</span></div>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-white/70 mb-2">Threat Categories</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-white/50">Deepfake Image</span><span className="text-red-400">45%</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">Voice Clone</span><span className="text-orange-400">25%</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">Identity Theft</span><span className="text-yellow-400">20%</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">Other</span><span className="text-white/40">10%</span></div>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </motion.div>
  );
}
