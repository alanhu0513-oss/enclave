import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldX, Lock, Radar, FileText, Eye, Loader2, Sparkles } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn } from "@/components/ui/motion";
import { greenGlow } from "@/lib/motion-presets";
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

  const [shieldStatus, setShieldStatus] = useState<Record<string, "secure" | "scanning" | "alert">>(() => ({
    crawler: "secure",
    monitor: "secure",
    biometric: "secure",
    takedown: "secure",
    rights: "secure",
  }));
  const [simulating, setSimulating] = useState(false);

  function triggerSimulatedIntrusion() {
    const activeShieldKeys = Object.keys(toggles).filter((k) => toggles[k]);
    if (activeShieldKeys.length === 0) {
      toast({
        title: "Simulation Canceled",
        variant: "info",
      });
      return;
    }

    setSimulating(true);
    const targetKey = activeShieldKeys[Math.floor(Math.random() * activeShieldKeys.length)];
    const shieldName = SHIELDS.find((s) => s.key === targetKey)?.name || targetKey;

    // Phase 1: Alert (Red)
    setShieldStatus((prev) => ({ ...prev, [targetKey]: "alert" }));
    toast({
      title: `🚨 Intercepted Deepfake Activity via ${shieldName}`,
      variant: "error",
    });

    // Phase 2: Scanning (Amber) after 3s
    setTimeout(() => {
      setShieldStatus((prev) => ({ ...prev, [targetKey]: "scanning" }));
      toast({
        title: `⚡ Deploying Automated Quantum Decoy Shields`,
        variant: "info",
      });
    }, 3000);

    // Phase 3: Secure (Green) after 5.5s total
    setTimeout(() => {
      setShieldStatus((prev) => ({ ...prev, [targetKey]: "secure" }));
      setSimulating(false);
      toast({
        title: `🛡️ Defensive Perimeter Restored on ${shieldName}`,
        variant: "success",
      });
    }, 5500);
  }

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

      {/* Simulation Console Control Panel */}
      <FadeIn delay={0.1}>
        <Card className="border-amber/20 bg-[#07080c]/80 p-5 relative overflow-hidden backdrop-blur-xl shadow-[0_0_24px_rgba(255,176,32,0.12)] rounded-xl">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-amber tracking-widest font-bold">
                <span className="flex h-1.5 w-1.5 rounded-full bg-amber animate-ping" />
                [DIAGNOSTIC DECK // DEFENSIVE SHIELD OVERRIDE]
              </div>
              <h4 className="font-display text-sm font-bold text-ink">Intrusion Mitigation Simulation Console</h4>
              <p className="text-xs text-ink-muted">
                Inject deepfake mimic traffic payloads to verify active shield threshold triggers and color transition behaviors.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={triggerSimulatedIntrusion}
                disabled={simulating}
                className={cn(
                  "font-mono text-xs font-bold text-black px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,176,32,0.3)] shrink-0",
                  simulating ? "bg-amber/50 cursor-not-allowed" : "bg-amber hover:bg-amber/80 cursor-pointer"
                )}
              >
                {simulating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    SIMULATING...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                    Inject Mock Payload
                  </>
                )}
              </button>
            </div>
          </div>
        </Card>
      </FadeIn>

      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHIELDS.map((shield) => {
          const active = toggles[shield.key];
          const status = shieldStatus[shield.key] || "secure";
          return (
            <StaggerItem key={shield.key}>
              <Kinetic>
                <Card
                  className={cn(
                    "relative overflow-hidden transition-all duration-500",
                    active
                      ? status === "secure"
                        ? "border-green/20 shadow-lg shadow-green/5 bg-green/5"
                        : status === "scanning"
                        ? "border-amber/20 shadow-lg shadow-amber/5 bg-amber/5"
                        : "border-red/40 shadow-xl shadow-red/10 bg-red/5 animate-pulse"
                      : "border-white/[0.06]"
                  )}
                  {...(active && status === "secure" ? greenGlow : {})}
                >
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
                      
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.04] pt-3">
                        <div className="flex items-center gap-2">
                          {active ? (
                            <div className="relative">
                              <span className={cn(
                                "absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5 rounded-full",
                                status === "secure" ? "bg-green animate-pulse" :
                                status === "scanning" ? "bg-amber animate-spin" : "bg-red animate-ping"
                              )} />
                              <Badge
                                variant={status === "secure" ? "green" : status === "scanning" ? "amber" : "red"}
                                className={cn(
                                  "text-[9px] font-mono font-bold tracking-wider uppercase transition-all duration-700 py-0.5",
                                  status === "secure" ? "shadow-[0_0_8px_rgba(0,255,136,0.25)] border-green/30" :
                                  status === "scanning" ? "shadow-[0_0_8px_rgba(255,176,32,0.25)] border-amber/30" :
                                  "shadow-[0_0_12px_rgba(255,71,87,0.4)] border-red/30 animate-pulse"
                                )}
                              >
                                {status === "secure" && (
                                  <>
                                    <ShieldCheck className="h-3 w-3 mr-1 text-green shrink-0" />
                                    SECURE
                                  </>
                                )}
                                {status === "scanning" && (
                                  <>
                                    <Radar className="h-3 w-3 mr-1 text-amber animate-spin shrink-0" />
                                    SCANNING
                                  </>
                                )}
                                {status === "alert" && (
                                  <>
                                    <Shield className="h-3 w-3 mr-1 text-red shrink-0" />
                                    THREAT FLAGGED
                                  </>
                                )}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="muted" className="text-[9px] font-mono tracking-wider">
                              <ShieldX className="h-3 w-3 mr-1 text-ink-faint shrink-0" /> INACTIVE
                            </Badge>
                          )}
                        </div>

                        {active && (
                          <span className={cn(
                            "text-[10px] font-mono font-semibold transition-colors duration-700",
                            status === "secure" ? "text-green" :
                            status === "scanning" ? "text-amber" : "text-red"
                          )}>
                            {status === "secure" && "ONLINE"}
                            {status === "scanning" && "DIAGNOSING..."}
                            {status === "alert" && "MITIGATING..."}
                          </span>
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
