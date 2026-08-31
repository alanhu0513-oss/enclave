import { motion } from "motion/react";
import {
  Shield,
  Check,
  X,
  Crown,
  Zap,
  Globe,
  Lock,
  Brain,
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
    tagline: "AI-powered identity protection",
    isEnclave: true,
    features: {
      realTimeScanning: true,
      deepfakeDetection: true,
      voiceCloneDetection: true,
      socialMediaMonitoring: true,
      autoTakedown: true,
      legalDocuments: true,
      insurance: true,
      identityPassport: true,
      familyPlan: true,
      enterpriseSSO: true,
      apiAccess: true,
      mobileApps: true,
      openSource: true,
      communityThreats: true,
    },
    pricing: "$0 - $49.99/mo",
    rating: 4.8,
  },
  {
    name: "Competitor A",
    logo: Globe,
    tagline: "Basic deepfake detection",
    isEnclave: false,
    features: {
      realTimeScanning: false,
      deepfakeDetection: true,
      voiceCloneDetection: false,
      socialMediaMonitoring: false,
      autoTakedown: false,
      legalDocuments: false,
      insurance: false,
      identityPassport: false,
      familyPlan: false,
      enterpriseSSO: false,
      apiAccess: false,
      mobileApps: true,
      openSource: false,
      communityThreats: false,
    },
    pricing: "$9.99/mo",
    rating: 3.2,
  },
  {
    name: "Competitor B",
    logo: Lock,
    tagline: "Enterprise security suite",
    isEnclave: false,
    features: {
      realTimeScanning: true,
      deepfakeDetection: true,
      voiceCloneDetection: false,
      socialMediaMonitoring: true,
      autoTakedown: true,
      legalDocuments: false,
      insurance: false,
      identityPassport: false,
      familyPlan: false,
      enterpriseSSO: true,
      apiAccess: true,
      mobileApps: false,
      openSource: false,
      communityThreats: false,
    },
    pricing: "$99/mo",
    rating: 3.8,
  },
  {
    name: "Competitor C",
    logo: Brain,
    tagline: "AI content moderation",
    isEnclave: false,
    features: {
      realTimeScanning: false,
      deepfakeDetection: true,
      voiceCloneDetection: true,
      socialMediaMonitoring: false,
      autoTakedown: false,
      legalDocuments: false,
      insurance: false,
      identityPassport: false,
      familyPlan: false,
      enterpriseSSO: false,
      apiAccess: true,
      mobileApps: true,
      openSource: false,
      communityThreats: false,
    },
    pricing: "$19.99/mo",
    rating: 3.5,
  },
];

const featureLabels: Record<string, string> = {
  realTimeScanning: "Real-Time Scanning",
  deepfakeDetection: "Deepfake Detection",
  voiceCloneDetection: "Voice Clone Detection",
  socialMediaMonitoring: "Social Media Monitoring",
  autoTakedown: "Auto Takedown",
  legalDocuments: "Legal Documents",
  insurance: "Identity Insurance",
  identityPassport: "Identity Passport",
  familyPlan: "Family Plan",
  enterpriseSSO: "Enterprise SSO",
  apiAccess: "API Access",
  mobileApps: "Mobile Apps",
  openSource: "Open Source",
  communityThreats: "Community Threats",
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
            <h2 className="text-3xl font-bold text-white mb-2">The Most Complete Protection</h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Enclave combines real-time scanning, AI detection, identity protection, and community intelligence
              in one platform. No other solution offers this breadth of features.
            </p>
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-cyan-400">14</p>
                <p className="text-sm text-white/60">Features</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">100%</p>
                <p className="text-sm text-white/60">Coverage</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">$0</p>
                <p className="text-sm text-white/60">Starting Price</p>
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
            <h3 className="text-xl font-bold text-white mb-2">Ready to protect yourself?</h3>
            <p className="text-white/60 mb-4">Start for free, no credit card required.</p>
            <Button className="bg-cyan-500 text-black font-semibold" onClick={() => setTab('home')}>
              <Zap className="w-4 h-4 mr-2" />
              Get Started Free
            </Button>
          </CardContent>
        </Card>
      </StaggerItem>
    </motion.div>
  );
}
