import { motion } from "motion/react";
import {
  Shield,
  Check,
  X,
  Crown,
  Zap,
  Globe,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { useApp } from "@/lib/app-context";
import { SectionHeader } from "@/components/ui/dashboard";

const competitors = [
  {
    name: "Enclave",
    logo: Shield,
    tagline: "The Account Shield — breach + stealer intelligence that contains",
    isEnclave: true,
    features: {
      watchedAccounts: true,
      breachMonitoring: true,
      stealerLogs: true,
      exploitability: true,
      blastRadius: true,
      autoSweep: true,
      containAll: true,
      credentialVault: true,
      deepfakeDetection: true,
      darkWebMonitoring: true,
      familyPlan: true,
      enterpriseSSO: true,
      apiAccess: true,
      mobileApps: true,
    },
    pricing: "$0 – $49.99/mo",
    rating: 4.8,
  },
  {
    name: "Breach Checkers",
    logo: Globe,
    tagline: "One-time 'am I leaked' lookups",
    isEnclave: false,
    features: {
      watchedAccounts: false,
      breachMonitoring: true,
      stealerLogs: false,
      exploitability: false,
      blastRadius: false,
      autoSweep: true,
      containAll: false,
      credentialVault: false,
      deepfakeDetection: false,
      darkWebMonitoring: false,
      familyPlan: false,
      enterpriseSSO: false,
      apiAccess: false,
      mobileApps: true,
    },
    pricing: "Free – $15/mo",
    rating: 3.4,
  },
  {
    name: "Password Managers",
    logo: KeyRound,
    tagline: "Vaults that hold, not watch",
    isEnclave: false,
    features: {
      watchedAccounts: false,
      breachMonitoring: true,
      stealerLogs: false,
      exploitability: false,
      blastRadius: false,
      autoSweep: false,
      containAll: false,
      credentialVault: true,
      deepfakeDetection: false,
      darkWebMonitoring: false,
      familyPlan: true,
      enterpriseSSO: true,
      apiAccess: true,
      mobileApps: true,
    },
    pricing: "$3 – $24/mo",
    rating: 4.2,
  },
  {
    name: "Identity Theft Services",
    logo: ShieldAlert,
    tagline: "Credit monitoring, high price",
    isEnclave: false,
    features: {
      watchedAccounts: false,
      breachMonitoring: true,
      stealerLogs: false,
      exploitability: false,
      blastRadius: false,
      autoSweep: true,
      containAll: true,
      credentialVault: false,
      deepfakeDetection: false,
      darkWebMonitoring: true,
      familyPlan: true,
      enterpriseSSO: false,
      apiAccess: false,
      mobileApps: true,
    },
    pricing: "$10 – $40/mo",
    rating: 3.7,
  },
];

const featureLabels: Record<string, string> = {
  watchedAccounts: "Watched-account shield",
  breachMonitoring: "Breach corpus monitoring (1.2B+)",
  stealerLogs: "Live infostealer-log intelligence",
  exploitability: "Exploitability scoring per account",
  blastRadius: "Blast-radius mapping",
  autoSweep: "6-hour auto-sweep",
  containAll: "Contain-all lockdown playbooks",
  credentialVault: "Encrypted credential vault",
  deepfakeDetection: "Deepfake detection",
  darkWebMonitoring: "Dark-web + paste monitoring",
  familyPlan: "Family plan",
  enterpriseSSO: "Enterprise SSO",
  apiAccess: "API Access",
  mobileApps: "Mobile Apps",
};

export function ComparisonView() {
  const { setTab } = useApp();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={Shield} title="Why Enclave?" description="Compare us with the competition" />

      {/* Hero */}
      <StaggerItem>
        <Card className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border-cyan-500/20">
          <CardContent className="p-8 text-center">
            <Crown className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">Every account behind the shield</h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Enclave is the only shield that watches your accounts against breach dumps and live
              infostealer logs, maps the blast radius of reused passwords, and contains a leak with
              one-tap lockdown playbooks. A checker tells you something leaked — Enclave stops it spreading.
            </p>
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-cyan-400">250</p>
                <p className="text-sm text-white/60">Watched accounts</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">6h</p>
                <p className="text-sm text-white/60">Auto-sweep cycle</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">1.2B+</p>
                <p className="text-sm text-white/60">Records checked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Comparison Table */}
      <StaggerContainer className="overflow-x-auto">
        <StaggerItem>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-4 text-left text-sm font-semibold text-white/60">Feature</th>
                    {competitors.map(comp => (
                      <th key={comp.name} className={`p-4 text-center text-sm font-semibold ${comp.isEnclave ? "text-cyan-400" : "text-white/60"}`}>
                        <div className="flex flex-col items-center gap-1">
                          <comp.logo className={`w-5 h-5 ${comp.isEnclave ? "text-cyan-400" : "text-white/40"}`} />
                          <span>{comp.name}</span>
                          {comp.isEnclave && <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">Best</Badge>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(featureLabels).map(([key, label]) => (
                    <tr key={key} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="p-4 text-sm text-white/80">{label}</td>
                      {competitors.map(comp => (
                        <td key={comp.name} className="p-4 text-center">
                          {comp.features[key as keyof typeof comp.features] ? (
                            <Check className={`w-5 h-5 mx-auto ${comp.isEnclave ? "text-cyan-400" : "text-emerald-400"}`} />
                          ) : (
                            <X className="w-5 h-5 mx-auto text-white/20" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-white/10">
                    <td className="p-4 text-sm font-semibold text-white/80">Pricing</td>
                    {competitors.map(comp => (
                      <td key={comp.name} className="p-4 text-center text-sm text-white/60">{comp.pricing}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* CTA */}
      <StaggerItem>
        <Card className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border-cyan-500/20">
          <CardContent className="p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Ready to build your shield?</h3>
            <p className="text-white/60 mb-4">Start free with 3 watched accounts — no credit card required.</p>
            <Button className="bg-cyan-500 text-black font-semibold" onClick={() => setTab('home')}>
              <Zap className="w-4 h-4 mr-2" />
              Build my shield free
            </Button>
          </CardContent>
        </Card>
      </StaggerItem>
    </motion.div>
  );
}
