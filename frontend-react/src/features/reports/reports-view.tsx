import { useEffect, useState } from "react";
import {
  FileText,
  Loader2,
  Download,
  CalendarClock,
  Play,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { generateScanReport } from "./pdf-export";
import { exportAlertsCSV } from "./csv-export";

export function ReportsView() {
  const { toast } = useApp();
  const [types, setTypes] = useState<any>({});
  const [reports, setReports] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [t, r, s, u] = await Promise.all([
        api.getReportTypes().then((x: any) => (x?.types ? x.types : x || {})),
        api.getReports(20).then((x: any) => (Array.isArray(x) ? x : x?.reports || [])),
        api.getReportSchedules().then((x: any) => (Array.isArray(x) ? x : x || [])),
        api.getUserData().catch(() => null),
      ]);
      setTypes(t);
      setReports(r);
      setSchedules(Array.isArray(s) ? s : []);
      setUserData(u);
    } catch (e: any) {
      toast({ title: "Failed to load reports", body: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate(type: string) {
    setGenerating(type);
    try {
      await api.generateReport({ type });
      toast({ title: "Report generated", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Generate failed", body: e.message, variant: "error" });
    } finally {
      setGenerating(null);
    }
  }

  async function scheduleWeekly(type: string, day = "MONDAY") {
    setBusy(true);
    try {
      await api.scheduleReport({ type, schedule: "weekly", dayOfWeek: day });
      toast({ title: "Weekly report scheduled", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Schedule failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  function download(id: string) {
    const base = api.getBaseUrl();
    window.open(base + "/reports/" + id + "/download", "_blank");
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Reports & Analytics</h2>
            <p className="text-sm text-ink-muted">Generate and schedule detailed security reports</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!userData?.alerts?.length}
            onClick={() => {
              try {
                generateScanReport(userData);
                toast({ title: "PDF exported", variant: "success" });
              } catch (e: any) {
                toast({ title: "Export failed", body: e.message, variant: "error" });
              }
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!userData?.alerts?.length}
            onClick={() => {
              try {
                exportAlertsCSV(userData?.alerts || []);
                toast({ title: "CSV exported", variant: "success" });
              } catch (e: any) {
                toast({ title: "Export failed", body: e.message, variant: "error" });
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report type cards */}
      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(types).map(([key, meta]: any) => (
          <StaggerItem key={key}>
            <Card className="h-full">
              <CardHeader>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
                  <FileText className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm">{meta.name}</CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button variant="glass" size="sm" className="flex-1" disabled={generating === key} onClick={() => generate(key)}>
                  {generating === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Generate
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => scheduleWeekly(key)}>
                  <CalendarClock className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Past reports */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>Your recent report downloads</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No reports generated yet.</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green/15 text-green">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink capitalize">
                      {r.reportType?.replace(/_/g, " ") || "Report"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {r.format?.toUpperCase()} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="muted">{r.status}</Badge>
                  <Button variant="glass" size="sm" onClick={() => download(r.id)}>
                    <Download className="h-4 w-4" /> Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduled reports */}
      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Schedules</CardTitle>
            <CardDescription>Recurring reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <CalendarClock className="h-4 w-4 text-purple" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink capitalize">{s.reportType?.replace(/_/g, " ")}</p>
                  <p className="text-xs text-ink-muted">{s.frequency} · next {new Date(s.nextRunAt).toLocaleString()}</p>
                </div>
                <Badge variant="cyan">Active</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
