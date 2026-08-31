import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Globe,
  Shield,
  AlertTriangle,
  Map,
  Radio,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";
import { api } from "@/lib/api";

interface IOC {
  id: string;
  type: string;
  value: string;
  threat: string;
  severity: string;
  confidence: number;
  reports: number;
  region: string;
  firstSeen: string;
  lastSeen: string;
  verified: boolean;
}

interface HeatmapEntry {
  region: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  threatLevel: string;
}

export function ThreatIntelView() {
  const [iocs, setIOCs] = useState<IOC[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"feed" | "heatmap" | "report">("feed");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [iocsRes, heatmapRes] = await Promise.all([
        api.getThreatIOCs(),
        api.getThreatHeatmap(),
      ]);
      setIOCs(iocsRes.iocs || []);
      setHeatmap(heatmapRes.heatmap || []);
    } catch (e) {
      console.error("Failed to load threat intel:", e);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "low": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default: return "bg-white/5 text-white/60 border-white/10";
    }
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case "severe": return "text-red-400";
      case "high": return "text-orange-400";
      case "moderate": return "text-amber-400";
      case "low": return "text-emerald-400";
      default: return "text-white/40";
    }
  };

  const filteredIOCs = iocs.filter(ioc => {
    if (filterSeverity && ioc.severity !== filterSeverity) return false;
    if (searchQuery && !ioc.value.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={Globe} title="Threat Intelligence" description="Community-driven IOC database" />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total IOCs", value: iocs.length, icon: Radio, color: "text-cyan-400" },
          { label: "Critical", value: iocs.filter(i => i.severity === "critical").length, icon: AlertTriangle, color: "text-red-400" },
          { label: "Verified", value: iocs.filter(i => i.verified).length, icon: Shield, color: "text-emerald-400" },
          { label: "Regions", value: heatmap.length, icon: Map, color: "text-violet-400" },
        ].map(stat => (
          <StaggerItem key={stat.label}>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/60">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["feed", "heatmap", "report"] as const).map(tab => (
          <Button key={tab} onClick={() => setActiveTab(tab)} variant={activeTab === tab ? "default" : "ghost"} className={activeTab === tab ? "bg-cyan-500 text-black" : "text-white/60"}>
            {tab === "feed" ? "IOC Feed" : tab === "heatmap" ? "Regional Heatmap" : "Report IOC"}
          </Button>
        ))}
      </div>

      {/* Feed Tab */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input placeholder="Search IOCs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" />
            </div>
            <div className="flex gap-1">
              {["", "critical", "high", "medium", "low"].map(sev => (
                <Button key={sev} onClick={() => setFilterSeverity(sev)} size="sm" variant={filterSeverity === sev ? "default" : "ghost"} className={filterSeverity === sev ? "bg-cyan-500 text-black" : "text-white/60"}>
                  {sev || "All"}
                </Button>
              ))}
            </div>
          </div>

          <StaggerContainer className="space-y-3">
            {filteredIOCs.map(ioc => (
              <StaggerItem key={ioc.id}>
                <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-cyan-400">{ioc.value}</p>
                          <Badge className={getSeverityColor(ioc.severity)}>{ioc.severity}</Badge>
                          {ioc.verified && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Verified</Badge>}
                        </div>
                        <p className="text-xs text-white/60 mt-1">{ioc.type} • {ioc.region} • {ioc.reports} reports</p>
                      </div>
                      <p className="text-xs text-white/40">{new Date(ioc.lastSeen).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      )}

      {/* Heatmap Tab */}
      {activeTab === "heatmap" && (
        <StaggerContainer className="grid grid-cols-4 gap-4">
          {heatmap.map(entry => (
            <StaggerItem key={entry.region}>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4 text-center">
                  <Map className={`w-6 h-6 mx-auto mb-2 ${getThreatColor(entry.threatLevel)}`} />
                  <p className="font-semibold text-white">{entry.region}</p>
                  <p className={`text-sm ${getThreatColor(entry.threatLevel)}`}>{entry.threatLevel}</p>
                  <p className="text-xs text-white/60 mt-1">{entry.total} IOCs</p>
                  <div className="flex justify-center gap-2 mt-2">
                    <span className="text-xs text-red-400">{entry.critical}C</span>
                    <span className="text-xs text-orange-400">{entry.high}H</span>
                    <span className="text-xs text-amber-400">{entry.medium}M</span>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Report Tab */}
      {activeTab === "report" && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">Report an IOC</h3>
            <p className="text-sm text-white/60 mt-1">Submit indicators of compromise to the community database</p>
            <Button className="mt-4 bg-cyan-500 text-black" onClick={() => {}}>Report IOC</Button>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
