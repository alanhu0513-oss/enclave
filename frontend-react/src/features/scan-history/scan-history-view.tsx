import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  History,
  CheckCircle2,
  AlertTriangle,
  Search,
  Loader2,
  ExternalLink,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaggerContainer, StaggerItem, FadeIn } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { timeAgo } from "@/lib/utils";

interface ScanRecord {
  id: string;
  type: "image" | "url" | "text" | "audio" | "video" | "deep";
  target: string;
  status: "completed" | "processing" | "failed" | "safe" | "threat" | "pending" | "PENDING_REVIEW" | "RESOLVED_SAFE" | "TAKEDOWN_SENT";
  confidence?: number;
  result?: string;
  created_at: string;
  source?: string;
  engine?: string;
  matchedOn?: string;
}

const TYPE_COLORS: Record<string, string> = {
  image: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  url: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  text: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  audio: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  video: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  deep: "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400",
  safe: "bg-emerald-500/10 text-emerald-400",
  processing: "bg-blue-500/10 text-blue-400",
  failed: "bg-red-500/10 text-red-400",
  threat: "bg-red-500/10 text-red-400",
  pending: "bg-amber-500/10 text-amber-400",
  PENDING_REVIEW: "bg-amber-500/10 text-amber-400",
  RESOLVED_SAFE: "bg-emerald-500/10 text-emerald-400",
  TAKEDOWN_SENT: "bg-purple-500/10 text-purple-400",
};

const ENGINE_LABELS: Record<string, string> = {
  google: "Google",
  bing: "Bing",
  yandex: "Yandex",
  duckduckgo: "DuckDuckGo",
  reddit: "Reddit",
  twitter: "X/Twitter",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  telegram: "Telegram",
  pastebin: "Pastebin",
  "4chan": "4chan",
  ahmia: "Ahmia (Tor)",
  "ahmia-tor": "Tor Hidden Services",
  "dark-forum": "Dark Web Forum",
  "dark-paste": "Dark Web Paste",
  web: "Web Search",
  unknown: "Unknown",
};

export function ScanHistoryView() {
  const { toast } = useApp();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    setLoading(true);
    try {
      const data = await api.getAlerts();
      const records: ScanRecord[] = (data || []).map((alert: any) => ({
        id: alert.id,
        type: alert.mediaType || "url",
        target: alert.sourceUrl || "Unknown",
        status: alert.status || "pending",
        confidence: alert.confidence,
        result: alert.matchedOn || alert.notes || "Match detected",
        created_at: alert.timestamp || alert.created_at,
        source: alert.sourceUrl,
        engine: alert.engine || "unknown",
        matchedOn: alert.matchedOn,
      }));
      setScans(records);
    } catch (e: any) {
      console.error("Failed to load alerts:", e);
      toast({ title: "Failed to load scan history", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  const filteredScans = scans.filter((scan) => {
    if (searchQuery && !scan.target.toLowerCase().includes(searchQuery.toLowerCase()) && !scan.matchedOn?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter !== "all" && scan.type !== typeFilter) return false;
    if (statusFilter !== "all" && scan.status !== statusFilter) return false;
    return true;
  });

  const threatCount = scans.filter((s) => s.confidence && s.confidence >= 50).length;
  const safeCount = scans.filter((s) => s.status === "safe" || s.status === "completed" || s.status === "RESOLVED_SAFE").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <FadeIn>
        <SectionHeader
          icon={History}
          title="Scan History"
          description="Review past scans and detection results"
          action={
            <Button variant="ghost" size="sm" onClick={loadAlerts} disabled={loading}>
              <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />
      </FadeIn>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StaggerItem>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-white">{scans.length}</p>
              <p className="text-xs text-white/60">Total Scans</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-red-500/5 border-red-500/10">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-red-400">{threatCount}</p>
              <p className="text-xs text-white/60">Threats Detected</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-emerald-500/5 border-emerald-500/10">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-400">{safeCount}</p>
              <p className="text-xs text-white/60">Safe</p>
            </CardContent>
          </Card>
        </StaggerItem>
      </div>

      {/* Filters */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search scans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
            >
              <option value="all">All Types</option>
              <option value="image">Image</option>
              <option value="url">URL</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="deep">Deep Scan</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
            >
              <option value="all">All Status</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="RESOLVED_SAFE">Resolved Safe</option>
              <option value="TAKEDOWN_SENT">Takedown Sent</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Scan List */}
      {loading ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-cyan" />
          </CardContent>
        </Card>
      ) : filteredScans.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/70">No scans found</p>
            <p className="text-xs text-white/40 mt-1">
              {scans.length === 0 ? "Run a scan to get started" : "Try adjusting your filters"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <StaggerContainer className="space-y-3">
          {filteredScans.map((scan) => {
            const isThreat = scan.confidence && scan.confidence >= 50;
            const StatusIcon = isThreat ? AlertTriangle : CheckCircle2;
            return (
              <StaggerItem key={scan.id}>
                <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`shrink-0 rounded-full p-2 ${isThreat ? "bg-red/10" : "bg-emerald-500/10"}`}>
                        <StatusIcon className={`h-5 w-5 ${isThreat ? "text-red" : "text-emerald-400"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={TYPE_COLORS[scan.type] || TYPE_COLORS.url}>
                            {scan.type.toUpperCase()}
                          </Badge>
                          <Badge className={STATUS_COLORS[scan.status] || STATUS_COLORS.pending}>
                            {scan.status.replace(/_/g, " ")}
                          </Badge>
                          {scan.engine && scan.engine !== "unknown" && (
                            <Badge className="bg-white/5 text-white/60 border-white/10">
                              {ENGINE_LABELS[scan.engine] || scan.engine}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-white truncate">{scan.target}</p>
                        <p className="text-xs text-white/50 mt-1">{scan.matchedOn || scan.result}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {scan.confidence !== undefined && (
                            <span className={`text-xs font-medium ${isThreat ? "text-red" : "text-emerald-400"}`}>
                              {scan.confidence}% confidence
                            </span>
                          )}
                          <span className="text-xs text-white/40">
                            {scan.created_at ? timeAgo(scan.created_at) : "Unknown time"}
                          </span>
                        </div>
                      </div>
                      {scan.source && (
                        <a
                          href={scan.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-2 text-white/40 hover:text-cyan transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}
    </motion.div>
  );
}
