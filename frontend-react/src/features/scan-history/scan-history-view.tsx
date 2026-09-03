import { useState } from "react";
import { motion } from "motion/react";
import {
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";

interface ScanRecord {
  id: string;
  type: "image" | "url" | "text" | "audio" | "video";
  target: string;
  status: "completed" | "processing" | "failed" | "safe" | "threat";
  confidence?: number;
  result?: string;
  created_at: string;
  source?: string;
}

const SCAN_TYPE_COLORS: Record<string, string> = {
  image: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  url: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  text: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  audio: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  video: "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400",
  safe: "bg-emerald-500/10 text-emerald-400",
  processing: "bg-blue-500/10 text-blue-400",
  failed: "bg-red-500/10 text-red-400",
  threat: "bg-red-500/10 text-red-400",
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  safe: CheckCircle2,
  processing: Clock,
  failed: AlertTriangle,
  threat: AlertTriangle,
};

const fallbackHistory: ScanRecord[] = [
  { id: "1", type: "image", target: "profile_photo.jpg", status: "safe", confidence: 98, result: "No manipulation detected", created_at: "2025-09-03T10:30:00Z" },
  { id: "2", type: "url", target: "https://suspicious-site.com/image.png", status: "threat", confidence: 87, result: "Deepfake face detected — high confidence manipulation", created_at: "2025-09-02T14:15:00Z" },
  { id: "3", type: "image", target: "selfie_2025.png", status: "safe", confidence: 99, result: "Authentic image — no synthetic markers found", created_at: "2025-09-01T09:45:00Z" },
  { id: "4", type: "audio", target: "voice_message.mp3", status: "completed", confidence: 92, result: "Natural voice — no cloning artifacts detected", created_at: "2025-08-30T16:20:00Z" },
  { id: "5", type: "video", target: "interview_clip.mp4", status: "threat", confidence: 95, result: "Face swap detected — lips don't match audio", created_at: "2025-08-28T11:00:00Z" },
  { id: "6", type: "url", target: "https://reddit.com/r/deepfakes/post123", status: "completed", confidence: 45, result: "Inconclusive — low resolution image, manual review recommended", created_at: "2025-08-25T08:30:00Z" },
  { id: "7", type: "image", target: "marketing_headshot.jpg", status: "safe", confidence: 97, result: "Original photo — metadata consistent", created_at: "2025-08-20T13:10:00Z" },
  { id: "8", type: "audio", target: "phone_call_recording.wav", status: "threat", confidence: 89, result: "Voice cloning detected — spectral anomalies in high frequencies", created_at: "2025-08-18T15:45:00Z" },
];

export function ScanHistoryView() {
  const [scans] = useState<ScanRecord[]>(fallbackHistory);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredScans = scans.filter((scan) => {
    if (searchQuery && !scan.target.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter !== "all" && scan.type !== typeFilter) return false;
    return true;
  });

  const threatCount = scans.filter((s) => s.status === "threat").length;
  const safeCount = scans.filter((s) => s.status === "safe" || s.status === "completed").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={History} title="Scan History" description="Review past scans and detection results" />

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
          <Card className="bg-emerald-500/5 border-emerald-500/10">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-400">{safeCount}</p>
              <p className="text-xs text-white/60">Safe</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-red-500/5 border-red-500/10">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-red-400">{threatCount}</p>
              <p className="text-xs text-white/60">Threats Found</p>
            </CardContent>
          </Card>
        </StaggerItem>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search scan targets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white"
          />
        </div>
        <div className="flex gap-1">
          {["all", "image", "url", "text", "audio", "video"].map((type) => (
            <Button
              key={type}
              onClick={() => setTypeFilter(type)}
              size="sm"
              variant={typeFilter === type ? "default" : "ghost"}
              className={typeFilter === type ? "bg-cyan-500 text-black" : "text-white/60"}
            >
              {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Scan List */}
      <StaggerContainer className="space-y-2">
        {filteredScans.map((scan) => {
          const StatusIcon = STATUS_ICONS[scan.status] || Clock;
          return (
            <StaggerItem key={scan.id}>
              <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StatusIcon className={`h-4 w-4 shrink-0 ${STATUS_COLORS[scan.status]?.split(" ")[1] || "text-white/40"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className={SCAN_TYPE_COLORS[scan.type]}>
                            {scan.type.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium text-white truncate">{scan.target}</span>
                        </div>
                        <p className="text-xs text-white/50 mt-1 truncate">{scan.result}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {scan.confidence !== undefined && (
                        <div className="text-right">
                          <p className={`text-sm font-bold ${scan.confidence > 80 ? "text-white" : "text-white/60"}`}>
                            {scan.confidence}%
                          </p>
                          <p className="text-[10px] text-white/40">confidence</p>
                        </div>
                      )}
                      <span className="text-xs text-white/40">
                        {new Date(scan.created_at).toLocaleDateString()}
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {filteredScans.length === 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center">
            <History className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/60">No scans match your filters</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
