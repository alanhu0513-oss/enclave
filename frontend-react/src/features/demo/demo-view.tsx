import { useState } from "react";
import { motion } from "motion/react";
import {
  Play,
  Shield,
  ScanSearch,
  Bell,
  FileText,
  Globe,
  Users,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { useApp } from "@/lib/app-context";
import { SectionHeader } from "@/components/ui/dashboard";

const demoSteps = [
  {
    id: 1,
    title: "Real-Time Scanning",
    description: "Enclave monitors your social media feeds and alerts you to potential deepfakes.",
    icon: ScanSearch,
    color: "text-cyan-400",
    bgColor: "from-cyan-500/20 to-cyan-500/5",
  },
  {
    id: 2,
    title: "AI Detection",
    description: "Our advanced ML models analyze images, videos, and audio for synthetic manipulation.",
    icon: Shield,
    color: "text-violet-400",
    bgColor: "from-violet-500/20 to-violet-500/5",
  },
  {
    id: 3,
    title: "Instant Alerts",
    description: "Get notified immediately when a potential deepfake targeting you is detected.",
    icon: Bell,
    color: "text-amber-400",
    bgColor: "from-amber-500/20 to-amber-500/5",
  },
  {
    id: 4,
    title: "Auto Takedown",
    description: "Automatically generate legal documents and send takedown requests to platforms.",
    icon: FileText,
    color: "text-emerald-400",
    bgColor: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    id: 5,
    title: "Global Coverage",
    description: "Monitor the open web, dark web, and social media platforms worldwide.",
    icon: Globe,
    color: "text-rose-400",
    bgColor: "from-rose-500/20 to-rose-500/5",
  },
  {
    id: 6,
    title: "Family Protection",
    description: "Protect your entire family with shared monitoring and alerts.",
    icon: Users,
    color: "text-cyan-400",
    bgColor: "from-cyan-500/20 to-cyan-500/5",
  },
];

export function DemoView() {
  const [activeStep, setActiveStep] = useState(0);
  const { setTab } = useApp();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <SectionHeader icon={Play} title="See Enclave in Action" description="Interactive demo of our core features" />

      {/* Video Placeholder */}
      <StaggerItem>
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 overflow-hidden">
          <div className="aspect-video flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-violet-500/10" />
            <div className="relative text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 mx-auto rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-4 cursor-pointer hover:bg-cyan-500/30 transition-colors"
                onClick={() => window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank')}
              >
                <Play className="w-8 h-8 text-cyan-400 ml-1" />
              </motion.div>
              <h3 className="text-xl font-semibold text-white">Watch Demo Video</h3>
              <p className="text-sm text-white/60 mt-1">2 minutes • No signup required</p>
            </div>
          </div>
        </Card>
      </StaggerItem>

      {/* Feature Steps */}
      <StaggerContainer className="grid grid-cols-3 gap-4">
        {demoSteps.map((step, i) => (
          <StaggerItem key={step.id}>
            <Card
              className={`bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer ${
                activeStep === i ? "border-cyan-500/30 bg-cyan-500/5" : ""
              }`}
              onClick={() => setActiveStep(i)}
            >
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${step.bgColor} flex items-center justify-center mb-3`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <h3 className="font-semibold text-white text-sm">{step.title}</h3>
                <p className="text-xs text-white/60 mt-1">{step.description}</p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* CTA */}
      <StaggerItem>
        <Card className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border-cyan-500/20">
          <CardContent className="p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Ready to get started?</h3>
            <p className="text-white/60 mb-4">Join thousands protecting their digital identity.</p>
            <Button className="bg-cyan-500 text-black font-semibold" onClick={() => setTab('home')}>
              Start Free Trial <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </StaggerItem>
    </motion.div>
  );
}
