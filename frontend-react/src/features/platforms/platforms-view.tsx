import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Globe,
  Search,
  MessageSquare,
  Image,
  Video,
  Music,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ExternalLink,
  Shield,
  ScanSearch,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaggerContainer, StaggerItem, FadeIn } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

interface Platform {
  id: string;
  name: string;
  category: string;
  icon: typeof Globe;
  coverage: "full" | "partial" | "planned";
  scanTypes: string[];
  description: string;
  url?: string;
  engine?: string;
}

const PLATFORMS: Platform[] = [
  { id: "google", name: "Google", category: "Search Engines", icon: Search, coverage: "full", scanTypes: ["Image", "Video", "Web"], description: "Full image and video reverse search.", engine: "google" },
  { id: "bing", name: "Bing", category: "Search Engines", icon: Search, coverage: "full", scanTypes: ["Image", "Video"], description: "Reverse image and video search.", engine: "bing" },
  { id: "yandex", name: "Yandex", category: "Search Engines", icon: Search, coverage: "full", scanTypes: ["Image"], description: "Reverse image search with face recognition.", engine: "yandex" },
  { id: "duckduckgo", name: "DuckDuckGo", category: "Search Engines", icon: Search, coverage: "full", scanTypes: ["Web"], description: "Web result monitoring.", engine: "duckduckgo" },

  { id: "reddit", name: "Reddit", category: "Social Media", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video", "Text"], description: "Monitors r/deepfakes, r/DeepfakeDetection, r/SFWdeepfakes.", engine: "reddit" },
  { id: "twitter", name: "X (Twitter)", category: "Social Media", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video", "Text"], description: "Tracks image and video posts via site search.", engine: "twitter" },
  { id: "instagram", name: "Instagram", category: "Social Media", icon: Image, coverage: "full", scanTypes: ["Image", "Video"], description: "Monitors public posts for unauthorized image use.", engine: "instagram" },
  { id: "tiktok", name: "TikTok", category: "Social Media", icon: Video, coverage: "full", scanTypes: ["Video", "Audio"], description: "Video content scanning and audio fingerprinting.", engine: "tiktok" },
  { id: "facebook", name: "Facebook", category: "Social Media", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video"], description: "Public post monitoring and image matching.", engine: "facebook" },
  { id: "youtube", name: "YouTube", category: "Social Media", icon: Video, coverage: "full", scanTypes: ["Video", "Audio"], description: "Video frame analysis and audio fingerprinting.", engine: "youtube" },
  { id: "linkedin", name: "LinkedIn", category: "Social Media", icon: FileText, coverage: "full", scanTypes: ["Image", "Text"], description: "Profile picture monitoring and impersonation detection.", engine: "linkedin" },
  { id: "pinterest", name: "Pinterest", category: "Social Media", icon: Image, coverage: "full", scanTypes: ["Image"], description: "Reverse image search for unauthorized pins.", engine: "pinterest" },
  { id: "telegram", name: "Telegram", category: "Social Media", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video", "Audio"], description: "Channel and group monitoring.", engine: "telegram" },
  { id: "discord", name: "Discord", category: "Social Media", icon: MessageSquare, coverage: "partial", scanTypes: ["Image", "Video"], description: "Server monitoring for shared deepfake content." },

  { id: "pastebin", name: "Pastebin", category: "Paste Sites", icon: FileText, coverage: "full", scanTypes: ["Text", "Image"], description: "Monitors paste contents for leaked images.", engine: "pastebin" },
  { id: "ghostbin", name: "Ghostbin", category: "Paste Sites", icon: FileText, coverage: "full", scanTypes: ["Text"], description: "Tracks paste sites for data leaks." },
  { id: "pastebox", name: "Pastebox", category: "Paste Sites", icon: FileText, coverage: "full", scanTypes: ["Text"], description: "Searches pastebox.org for leaked data." },
  { id: "hastebin", name: "Hastebin", category: "Paste Sites", icon: FileText, coverage: "full", scanTypes: ["Text"], description: "Monitors hastebin.com for sensitive content." },
  { id: "rentry", name: "Rentry", category: "Paste Sites", icon: FileText, coverage: "full", scanTypes: ["Text"], description: "Searches rentry.co paste site." },

  { id: "4chan", name: "4chan", category: "Forums", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video"], description: "Board monitoring across /b/, /v/, /pol/.", engine: "4chan" },
  { id: "8kun", name: "8kun", category: "Forums", icon: MessageSquare, coverage: "full", scanTypes: ["Image"], description: "Image board monitoring." },

  { id: "tor", name: "Tor Hidden Services", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Image", "Video", "Text"], description: "Crawls .onion sites for deepfake marketplaces.", engine: "ahmia-tor" },
  { id: "ahmia", name: "Ahmia", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Image", "Text"], description: "Search engine for Tor hidden services.", engine: "ahmia" },
  { id: "torum", name: "Torum", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Text"], description: "Dark web social network monitoring.", engine: "dark-forum" },
  { id: "dread", name: "Dread", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Text", "Image"], description: "Reddit-style dark web forum monitoring.", engine: "dark-forum" },
  { id: "exploit", name: "Exploit.in", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Text"], description: "Russian dark web forum monitoring.", engine: "dark-forum" },
  { id: "nulled", name: "Nulled.to", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Text", "Image"], description: "Dark web forum monitoring.", engine: "dark-forum" },

  { id: "imgur", name: "Imgur", category: "File Sharing", icon: Image, coverage: "full", scanTypes: ["Image"], description: "Reverse image search across Imgur." },
  { id: "flickr", name: "Flickr", category: "File Sharing", icon: Image, coverage: "full", scanTypes: ["Image"], description: "Image matching across Flickr." },
  { id: "deviantart", name: "DeviantArt", category: "File Sharing", icon: Image, coverage: "partial", scanTypes: ["Image"], description: "Monitors art uploads for unauthorized use." },
  { id: "soundcloud", name: "SoundCloud", category: "File Sharing", icon: Music, coverage: "partial", scanTypes: ["Audio"], description: "Audio fingerprinting for voice clone detection." },
  { id: "vimeo", name: "Vimeo", category: "File Sharing", icon: Video, coverage: "partial", scanTypes: ["Video"], description: "Video content scanning." },

  { id: "pornhub", name: "Pornhub", category: "Adult Content", icon: Video, coverage: "full", scanTypes: ["Video", "Image"], description: "Monitors for non-consensual deepfake pornography." },
  { id: "xvideos", name: "XVideos", category: "Adult Content", icon: Video, coverage: "full", scanTypes: ["Video"], description: "Scans for deepfake pornographic content." },
  { id: "onlyfans", name: "OnlyFans", category: "Adult Content", icon: Image, coverage: "partial", scanTypes: ["Image", "Video"], description: "Detects unauthorized re-uploads." },
];

const COVERAGE_COLORS = {
  full: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  partial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  planned: "bg-white/5 text-white/40 border-white/10",
};

export function PlatformsView() {
  const { toast } = useApp();
  const [scanning, setScanning] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    setLoading(true);
    try {
      const data = await api.getAlerts();
      setAlerts(data || []);
    } catch (e: any) {
      console.error("Failed to load alerts:", e);
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    setScanning(true);
    toast({ title: "Deep scan started", body: "Scanning all platforms...", variant: "info" });
    try {
      await api.deepScan();
      toast({ title: "Deep scan complete", variant: "success" });
      await loadAlerts();
    } catch (e: any) {
      toast({ title: "Scan failed", body: e.message, variant: "error" });
    } finally {
      setScanning(false);
    }
  }

  function getAlertsForPlatform(platform: Platform): any[] {
    return alerts.filter((alert) => {
      const engine = alert.engine || "";
      const sourceUrl = alert.sourceUrl || "";
      const matchedOn = alert.matchedOn || "";

      if (platform.engine && engine === platform.engine) return true;
      if (platform.id === "google" && (engine === "web" || sourceUrl.includes("google"))) return true;
      if (platform.id === "bing" && (engine === "bing" || sourceUrl.includes("bing"))) return true;
      if (platform.id === "yandex" && (engine === "yandex" || sourceUrl.includes("yandex"))) return true;
      if (platform.id === "duckduckgo" && (engine === "duckduckgo" || sourceUrl.includes("duckduckgo"))) return true;
      if (platform.id === "reddit" && (engine === "reddit" || matchedOn.includes("reddit"))) return true;
      if (platform.id === "twitter" && (engine === "twitter" || matchedOn.includes("twitter"))) return true;
      if (platform.id === "instagram" && (engine === "instagram" || matchedOn.includes("instagram"))) return true;
      if (platform.id === "tiktok" && (engine === "tiktok" || matchedOn.includes("tiktok"))) return true;
      if (platform.id === "facebook" && (engine === "facebook" || matchedOn.includes("facebook"))) return true;
      if (platform.id === "youtube" && (engine === "youtube" || matchedOn.includes("youtube"))) return true;
      if (platform.id === "linkedin" && (engine === "linkedin" || matchedOn.includes("linkedin"))) return true;
      if (platform.id === "pinterest" && (engine === "pinterest" || matchedOn.includes("pinterest"))) return true;
      if (platform.id === "telegram" && (engine === "telegram" || matchedOn.includes("telegram"))) return true;
      if (platform.id === "pastebin" && (engine === "pastebin" || matchedOn.includes("pastebin"))) return true;
      if (platform.id === "4chan" && (engine === "4chan" || matchedOn.includes("4chan"))) return true;
      if (platform.id === "tor" && (engine === "ahmia-tor" || matchedOn.includes("tor"))) return true;
      if (platform.id === "ahmia" && (engine === "ahmia" || matchedOn.includes("ahmia"))) return true;
      if (["torum", "dread", "exploit", "nulled"].includes(platform.id) && engine === "dark-forum") return true;
      if (platform.id === "dark-paste" && engine === "dark-paste") return true;
      return false;
    });
  }

  const categories = [...new Set(PLATFORMS.map((p) => p.category))];
  const totalAlerts = alerts.length;
  const fullCount = PLATFORMS.filter((p) => p.coverage === "full").length;

  const selectedPlatformData = PLATFORMS.find((p) => p.id === selectedPlatform);
  const selectedAlerts = selectedPlatform ? getAlertsForPlatform(selectedPlatformData!) : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <FadeIn>
        <SectionHeader
          icon={Globe}
          title="Platform Coverage"
          description="Platforms and sources we monitor for deepfake and identity threats"
          action={
            <Button onClick={runScan} disabled={scanning} className="bg-gradient-to-r from-cyan to-green text-black font-semibold" size="sm">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {scanning ? "Scanning..." : "Run Full Scan"}
            </Button>
          }
        />
      </FadeIn>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StaggerItem>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xl font-bold text-white sm:text-2xl">{PLATFORMS.length}</p>
              <p className="text-[10px] text-white/60 sm:text-xs">Total Platforms</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-emerald-500/5 border-emerald-500/10">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xl font-bold text-emerald-400 sm:text-2xl">{fullCount}</p>
              <p className="text-[10px] text-white/60 sm:text-xs">Full Coverage</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-cyan-500/5 border-cyan-500/10">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xl font-bold text-cyan-400 sm:text-2xl">{totalAlerts}</p>
              <p className="text-[10px] text-white/60 sm:text-xs">Total Alerts</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-cyan-400 sm:h-5 sm:w-5" />
                <p className="text-xl font-bold text-white sm:text-2xl">Active</p>
              </div>
              <p className="text-[10px] text-white/60 sm:text-xs">Protection Status</p>
            </CardContent>
          </Card>
        </StaggerItem>
      </div>

      {/* Scan Types */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-white mb-3">What We Scan For</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { type: "Image", desc: "Deepfake faces, manipulated photos", icon: Image },
              { type: "Video", desc: "Face swaps, lip-sync manipulation", icon: Video },
              { type: "Audio", desc: "Voice clones, synthetic speech", icon: Music },
              { type: "Text", desc: "Identity leaks, personal data", icon: FileText },
              { type: "Web", desc: "Mentions, impersonation profiles", icon: Globe },
            ].map((item) => (
              <div key={item.type} className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-3">
                <item.icon className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-white">{item.type}</p>
                  <p className="text-[11px] text-white/50 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Platforms by Category */}
      {categories.map((category) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            {category}
            <span className="text-xs text-white/40 font-normal">
              ({PLATFORMS.filter((p) => p.category === category).length} platforms)
            </span>
          </h3>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PLATFORMS.filter((p) => p.category === category).map((platform) => {
              const platformAlerts = getAlertsForPlatform(platform);
              const isSelected = selectedPlatform === platform.id;
              return (
                <StaggerItem key={platform.id}>
                  <Card
                    className={`bg-white/5 border-white/10 hover:bg-white/[0.07] transition-all cursor-pointer ${isSelected ? "ring-1 ring-cyan/50" : ""}`}
                    onClick={() => setSelectedPlatform(isSelected ? null : platform.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <platform.icon className="h-4 w-4 text-white/60" />
                          <h4 className="text-sm font-medium text-white">{platform.name}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {platformAlerts.length > 0 && (
                            <Badge className="bg-cyan/10 text-cyan border-cyan/20 text-[10px]">
                              {platformAlerts.length} alert{platformAlerts.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          <Badge className={COVERAGE_COLORS[platform.coverage]}>
                            {platform.coverage === "full" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {platform.coverage === "partial" && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {platform.coverage === "planned" && <Clock className="w-3 h-3 mr-1" />}
                            {platform.coverage === "full" ? "Full" : platform.coverage === "partial" ? "Partial" : "Planned"}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-white/50 mb-2">{platform.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {platform.scanTypes.map((type) => {
                          const Icon = type === "Image" ? Image : type === "Video" ? Video : type === "Audio" ? Music : type === "Text" ? FileText : Globe;
                          return (
                            <span key={type} className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                              <Icon className="w-2.5 h-2.5" />
                              {type}
                            </span>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      ))}

      {/* Selected Platform Details */}
      {selectedPlatform && selectedPlatformData && (
        <FadeIn>
          <Card className="bg-white/5 border-cyan/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <selectedPlatformData.icon className="h-6 w-6 text-cyan" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedPlatformData.name}</h3>
                    <p className="text-xs text-white/50">{selectedPlatformData.description}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlatform(null)}>
                  Close
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan" />
                </div>
              ) : selectedAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm text-white/70">No alerts found for {selectedPlatformData.name}</p>
                  <p className="text-xs text-white/40 mt-1">Run a scan to check for threats</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-white/70">
                    Found <span className="font-semibold text-white">{selectedAlerts.length}</span> potential match{selectedAlerts.length !== 1 ? "es" : ""} on {selectedPlatformData.name}
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedAlerts.slice(0, 10).map((alert: any, i: number) => (
                      <div key={alert.id || i} className="flex items-start gap-3 rounded-lg bg-white/[0.03] p-3">
                        <AlertTriangle className="h-4 w-4 text-amber shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white truncate">{alert.sourceUrl || "Unknown source"}</p>
                          <p className="text-[10px] text-white/50 mt-1">
                            {alert.matchedOn} — {alert.confidence}% confidence
                          </p>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {alert.timestamp ? timeAgo(alert.timestamp) : "Unknown time"}
                          </p>
                        </div>
                        {alert.sourceUrl && (
                          <a
                            href={alert.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 p-1 text-white/40 hover:text-cyan"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  {selectedAlerts.length > 10 && (
                    <p className="text-xs text-white/40 text-center">
                      + {selectedAlerts.length - 10} more alerts
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </motion.div>
  );
}
