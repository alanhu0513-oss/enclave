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
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

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
          <Metric icon={TrendingUp} color="cyan" value={loading ? "—" : "92%"} label="Protection score" />
        </StaggerItem>
        <StaggerItem>
          <Metric icon={FileText} color="amber" value={loading ? "—" : String(reports?.length ?? 0)} label="Reports generated" />
        </StaggerItem>
      </StaggerContainer>

      {/* Reports */}
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
