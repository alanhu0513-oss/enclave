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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";

interface Platform {
  name: string;
  category: string;
  icon: typeof Globe;
  coverage: "full" | "partial" | "planned";
  scanTypes: string[];
  description: string;
  url?: string;
}

const PLATFORMS: Platform[] = [
  // Search Engines
  { name: "Google", category: "Search Engines", icon: Search, coverage: "full", scanTypes: ["Image", "Video", "Web"], description: "Full image and video reverse search across Google Images and Video.", url: "https://google.com" },
  { name: "Bing", category: "Search Engines", icon: Search, coverage: "full", scanTypes: ["Image", "Video"], description: "Reverse image and video search via Bing Visual Search API." },
  { name: "Yandex", category: "Search Engines", icon: Search, coverage: "full", scanTypes: ["Image"], description: "Reverse image search with face recognition capabilities." },
  { name: "DuckDuckGo", category: "Search Engines", icon: Search, coverage: "partial", scanTypes: ["Web"], description: "Web result monitoring for mentions and image references." },

  // Social Media
  { name: "Reddit", category: "Social Media", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video", "Text"], description: "Monitors posts, comments, and image uploads across all subreddits." },
  { name: "X (Twitter)", category: "Social Media", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video", "Text"], description: "Tracks image and video posts, profile pictures, and mentions." },
  { name: "Instagram", category: "Social Media", icon: Image, coverage: "partial", scanTypes: ["Image", "Video"], description: "Monitors public posts and stories for unauthorized image use." },
  { name: "TikTok", category: "Social Media", icon: Video, coverage: "partial", scanTypes: ["Video", "Audio"], description: "Video content scanning and audio fingerprinting for voice clones." },
  { name: "Facebook", category: "Social Media", icon: MessageSquare, coverage: "partial", scanTypes: ["Image", "Video"], description: "Public post monitoring and image matching across Facebook." },
  { name: "YouTube", category: "Social Media", icon: Video, coverage: "full", scanTypes: ["Video", "Audio"], description: "Video frame analysis and audio fingerprinting for deepfake detection." },
  { name: "LinkedIn", category: "Social Media", icon: FileText, coverage: "partial", scanTypes: ["Image", "Text"], description: "Profile picture monitoring and impersonation detection." },
  { name: "Pinterest", category: "Social Media", icon: Image, coverage: "partial", scanTypes: ["Image"], description: "Reverse image search for unauthorized pins and repins." },
  { name: "Telegram", category: "Social Media", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video", "Audio"], description: "Channel and group monitoring for shared deepfake content." },
  { name: "Discord", category: "Social Media", icon: MessageSquare, coverage: "partial", scanTypes: ["Image", "Video"], description: "Server and channel monitoring for shared manipulated media." },

  // Paste Sites & Forums
  { name: "Pastebin", category: "Paste Sites", icon: FileText, coverage: "full", scanTypes: ["Text", "Image"], description: "Monitors paste contents for leaked images and personal information." },
  { name: "Ghostbin", category: "Paste Sites", icon: FileText, coverage: "full", scanTypes: ["Text"], description: "Tracks paste sites for data leaks and identity exposure." },
  { name: "4chan", category: "Forums", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video"], description: "Board monitoring for deepfake image and video distribution." },
  { name: "8kun", category: "Forums", icon: MessageSquare, coverage: "full", scanTypes: ["Image"], description: "Image board monitoring for manipulated content." },
  { name: "Reddit (Dark)", category: "Forums", icon: MessageSquare, coverage: "full", scanTypes: ["Image", "Video", "Text"], description: "Monitors dark web Reddit mirrors and hidden subreddits." },

  // Dark Web
  { name: "Tor Hidden Services", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Image", "Video", "Text"], description: "Crawls .onion sites for deepfake marketplaces and forums." },
  { name: "Ahmia", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Image", "Text"], description: "Search engine for Tor hidden services, monitors indexed content." },
  { name: "Dark Web Forums", category: "Dark Web", icon: Globe, coverage: "full", scanTypes: ["Image", "Video", "Text"], description: "Monitors known dark web forums for identity theft and deepfake trades." },
  { name: "Marketplaces", category: "Dark Web", icon: Globe, coverage: "partial", scanTypes: ["Image", "Text"], description: "Tracks dark web marketplaces for stolen identity and deepfake services." },

  // File Sharing
  { name: "Imgur", category: "File Sharing", icon: Image, coverage: "full", scanTypes: ["Image"], description: "Reverse image search across Imgur's public gallery." },
  { name: "Flickr", category: "File Sharing", icon: Image, coverage: "full", scanTypes: ["Image"], description: "Image matching across Flickr's public photo database." },
  { name: "DeviantArt", category: "File Sharing", icon: Image, coverage: "partial", scanTypes: ["Image"], description: "Monitors art uploads for unauthorized use of likeness." },
  { name: "SoundCloud", category: "File Sharing", icon: Music, coverage: "partial", scanTypes: ["Audio"], description: "Audio fingerprinting for voice clone detection." },
  { name: "Vimeo", category: "File Sharing", icon: Video, coverage: "partial", scanTypes: ["Video"], description: "Video content scanning for deepfake manipulation." },

  // Pornographic Sites (Consensual Deepfake Pornography Detection)
  { name: "Pornhub", category: "Adult Content", icon: Video, coverage: "full", scanTypes: ["Video", "Image"], description: "Monitors for non-consensual deepfake pornography." },
  { name: "XVideos", category: "Adult Content", icon: Video, coverage: "full", scanTypes: ["Video"], description: "Scans for deepfake pornographic content using face matching." },
  { name: "OnlyFans", category: "Adult Content", icon: Image, coverage: "partial", scanTypes: ["Image", "Video"], description: "Detects unauthorized re-uploads and impersonation." },
];

const COVERAGE_COLORS = {
  full: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  partial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  planned: "bg-white/5 text-white/40 border-white/10",
};

const COVERAGE_LABELS = {
  full: "Full Coverage",
  partial: "Partial Coverage",
  planned: "Planned",
};

const SCAN_TYPE_ICONS: Record<string, typeof Globe> = {
  Image: Image,
  Video: Video,
  Audio: Music,
  Text: FileText,
  Web: Globe,
};

export function PlatformsView() {
  const categories = [...new Set(PLATFORMS.map((p) => p.category))];
  const fullCount = PLATFORMS.filter((p) => p.coverage === "full").length;
  const partialCount = PLATFORMS.filter((p) => p.coverage === "partial").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={Globe} title="Platform Coverage" description="Platforms and sources we monitor for deepfake and identity threats" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StaggerItem>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-white">{PLATFORMS.length}</p>
              <p className="text-xs text-white/60">Total Platforms</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-emerald-500/5 border-emerald-500/10">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-400">{fullCount}</p>
              <p className="text-xs text-white/60">Full Coverage</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="bg-amber-500/5 border-amber-500/10">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-400">{partialCount}</p>
              <p className="text-xs text-white/60">Partial Coverage</p>
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
              { type: "Text", desc: "Identity leaks, personal data exposure", icon: FileText },
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
            {PLATFORMS.filter((p) => p.category === category).map((platform) => (
              <StaggerItem key={platform.name}>
                <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <platform.icon className="h-4 w-4 text-white/60" />
                        <h4 className="text-sm font-medium text-white">{platform.name}</h4>
                      </div>
                      <Badge className={COVERAGE_COLORS[platform.coverage]}>
                        {platform.coverage === "full" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {platform.coverage === "partial" && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {platform.coverage === "planned" && <Clock className="w-3 h-3 mr-1" />}
                        {COVERAGE_LABELS[platform.coverage]}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/50 mb-2">{platform.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {platform.scanTypes.map((type) => {
                        const Icon = SCAN_TYPE_ICONS[type] || Globe;
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
            ))}
          </StaggerContainer>
        </div>
      ))}
    </motion.div>
  );
}
