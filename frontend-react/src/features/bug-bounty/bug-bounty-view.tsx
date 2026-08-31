import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Bug,
  Trophy,
  Shield,
  Star,
  DollarSign,
  Award,
  Users,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";
import { api } from "@/lib/api";

interface Vulnerability {
  id: string;
  title: string;
  severity: string;
  cvss: number;
  status: string;
  bounty: number;
  description: string;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  reports: number;
  resolved: number;
  earned: number;
  rank: number;
}

export function BugBountyView() {
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"vulns" | "leaderboard" | "policy">("vulns");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [vulnsRes, lbRes] = await Promise.all([
        api.getVulnerabilities(),
        api.getBugBountyLeaderboard(),
      ]);
      setVulns(vulnsRes.vulnerabilities || []);
      setLeaderboard(lbRes.leaderboard || []);
    } catch (e) {
      console.error("Failed to load bug bounty data:", e);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "low": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default: return "bg-white/5 text-white/60 border-white/10";
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "resolved": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "triaged": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "submitted": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      default: return "bg-white/5 text-white/60 border-white/10";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={Bug} title="Bug Bounty Program" description="Find vulnerabilities, earn rewards" />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Reports", value: vulns.length, icon: FileText, color: "text-cyan-400" },
          { label: "Resolved", value: vulns.filter(v => v.status === "resolved").length, icon: Shield, color: "text-emerald-400" },
          { label: "Paid Out", value: `$${vulns.reduce((s, v) => s + (v.bounty || 0), 0).toLocaleString()}`, icon: DollarSign, color: "text-amber-400" },
          { label: "Researchers", value: leaderboard.length, icon: Users, color: "text-violet-400" },
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
        {(["vulns", "leaderboard", "policy"] as const).map(tab => (
          <Button key={tab} onClick={() => setActiveTab(tab)} variant={activeTab === tab ? "default" : "ghost"} className={activeTab === tab ? "bg-cyan-500 text-black" : "text-white/60"}>
            {tab === "vulns" ? "Vulnerabilities" : tab === "leaderboard" ? "Leaderboard" : "Policy"}
          </Button>
        ))}
      </div>

      {/* Vulns Tab */}
      {activeTab === "vulns" && (
        <StaggerContainer className="space-y-3">
          {vulns.map(vuln => (
            <StaggerItem key={vuln.id}>
              <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{vuln.title}</h3>
                        <Badge className={getSeverityColor(vuln.severity)}>{vuln.severity}</Badge>
                        <Badge className={getStatusColor(vuln.status)}>{vuln.status}</Badge>
                      </div>
                      <p className="text-sm text-white/60 mt-1">{vuln.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">${vuln.bounty.toLocaleString()}</p>
                      <p className="text-xs text-white/40">CVSS {vuln.cvss}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Leaderboard Tab */}
      {activeTab === "leaderboard" && (
        <StaggerContainer className="space-y-3">
          {leaderboard.map((entry, i) => (
            <StaggerItem key={entry.userId}>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    {i === 0 ? <Trophy className="w-5 h-5 text-amber-400" /> :
                     i === 1 ? <Award className="w-5 h-5 text-gray-300" /> :
                     <Star className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">{entry.name}</p>
                    <p className="text-xs text-white/60">{entry.reports} reports • {entry.resolved} resolved</p>
                  </div>
                  <p className="text-lg font-bold text-amber-400">${entry.earned.toLocaleString()}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Policy Tab */}
      {activeTab === "policy" && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Responsible Disclosure Policy</h3>
            <div className="space-y-2 text-sm text-white/70">
              <p>Report vulnerabilities privately before public disclosure.</p>
              <p>Do not access or modify data belonging to other users.</p>
              <p>Allow 90 days for resolution before public disclosure.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {[
                { severity: "critical", range: "$3,000 - $10,000" },
                { severity: "high", range: "$1,000 - $3,000" },
                { severity: "medium", range: "$250 - $1,000" },
                { severity: "low", range: "$50 - $250" },
              ].map(tier => (
                <div key={tier.severity} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <Badge className={getSeverityColor(tier.severity)}>{tier.severity}</Badge>
                  <span className="text-sm text-white/60">{tier.range}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
