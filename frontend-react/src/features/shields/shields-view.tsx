import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldX, Lock, Radar, FileText, Eye } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { SectionHeader, PulseDot } from "@/components/ui/dashboard";
import { NativeShieldPanel } from "./native-shield-panel";

const SHIELDS = [
  { key: "crawler", name: "Proactive Crawler", desc: "Continuously searches the web for unauthorized copies of your identity.", icon: Eye, color: "cyan", gradient: "from-cyan/10 to-blue/10" },
  { key: "monitor", name: "Deep Web Monitor", desc: "Monitors dark web & forums for leaked credentials or impersonation.", icon: Radar, color: "purple", gradient: "from-purple/10 to-pink/10" },
  { key: "biometric", name: "Biometric Enrollment", desc: "Stores encrypted face/voice/signature profiles for matching.", icon: Lock, color: "green", gradient: "from-green/10 to-emerald/10" },
  { key: "takedown", name: "Auto Takedown", desc: "Files DMCA / takedown requests against flagged content automatically.", icon: FileText, color: "amber", gradient: "from-amber/10 to-orange/10" },
  { key: "rights", name: "Rights Shield", desc: "Watermarks & legal documentation to assert ownership fast.", icon: ShieldCheck, color: "cyan", gradient: "from-cyan/10 to-teal/10" },
] as const;

const SHIELDS_STORAGE_KEY = "enclave_shields_state";

export function getShieldStates(): Record<string, boolean> {
  if (typeof window === "undefined") return {
    crawler: true, monitor: true, biometric: false, takedown: false, rights: true,
  };
  const stored = localStorage.getItem(SHIELDS_STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }
  return { crawler: true, monitor: true, biometric: false, takedown: false, rights: true };
}

export function ShieldsView() {
  const { toast } = useApp();
  const [toggles, setToggles] = useState<Record<string, boolean>>(getShieldStates());

  useEffect(() => {
    localStorage.setItem(SHIELDS_STORAGE_KEY, JSON.stringify(toggles));
  }, [toggles]);

  const activeCount = Object.values(toggles).filter(Boolean).length;

  function toggle(key: string, val: boolean) {
    setToggles((t) => ({ ...t, [key]: val }));
    toast({
      title: val ? "Shield activated" : "Shield deactivated",
      body: key,
      variant: val ? "success" : "info",
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FadeIn>
        <SectionHeader
          icon={Shield}
          title="Active Shields"
          description={`${activeCount} of ${SHIELDS.length} defense layers protecting you`}
          action={
            <Badge variant="cyan" className="text-sm">
              <PulseDot color="cyan" size="sm" />
              {activeCount}/{SHIELDS.length} Online
            </Badge>
          }
        />
      </FadeIn>

      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHIELDS.map((shield) => {
          const active = toggles[shield.key];
          return (
            <StaggerItem key={shield.key}>
              <Kinetic>
                <Card className={cn(
                  "relative overflow-hidden transition-all duration-300",
                  active ? "border-green/20 shadow-lg shadow-green/5" : "border-white/[0.06]"
                )}>
                  <div className={cn("absolute inset-0 bg-gradient-to-br opacity-40", shield.gradient)} />
                  <div className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-xl",
                          `bg-${shield.color}/15 text-${shield.color}`
                        )}>
                          <shield.icon className="h-5 w-5" />
                        </div>
                        <Switch
                          checked={active}
                          onCheckedChange={(val) => toggle(shield.key, val)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <h3 className="mb-1 text-sm font-semibold text-ink">{shield.name}</h3>
                      <p className="text-xs leading-relaxed text-ink-muted">{shield.desc}</p>
                      <div className="mt-3 flex items-center gap-2">
                        {active ? (
                          <Badge variant="green" className="text-[10px]">
                            <ShieldCheck className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="muted" className="text-[10px]">
                            <ShieldX className="h-3 w-3 mr-1" /> Inactive
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Kinetic>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      <FadeIn delay={0.3}>
        <NativeShieldPanel />
      </FadeIn>
    </div>
  );
}
