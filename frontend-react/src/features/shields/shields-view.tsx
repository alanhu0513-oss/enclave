import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldX, Lock, Radar, FileText, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
  const [lastToggledKey, setLastToggledKey] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(SHIELDS_STORAGE_KEY, JSON.stringify(toggles));
  }, [toggles]);

  const activeCount = Object.values(toggles).filter(Boolean).length;

  function toggle(key: string, val: boolean) {
    setLastToggledKey(key);
    setToggles((t) => ({ ...t, [key]: val }));
    const shieldName = SHIELDS.find((s) => s.key === key)?.name || key;
    toast({
      title: val ? `🛡️ ${shieldName} Activated` : `⏸️ ${shieldName} Deactivated`,
      body: val ? "Real-time threat monitoring and mitigation active." : "Defense layer temporarily paused.",
      variant: val ? "success" : "info",
    });

    // Reset ripple indicator after animation completes
    setTimeout(() => {
      setLastToggledKey((current) => (current === key ? null : current));
    }, 600);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FadeIn>
        <SectionHeader
          icon={Shield}
          title="Active Shields"
          description={`${activeCount} of ${SHIELDS.length} defense layers protecting your digital identity`}
          action={
            <Badge variant="cyan" className="text-sm font-mono transition-all duration-300">
              <PulseDot color="cyan" size="sm" />
              {activeCount}/{SHIELDS.length} Online
            </Badge>
          }
        />
      </FadeIn>

      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHIELDS.map((shield) => {
          const active = toggles[shield.key];
          const isRecentlyToggled = lastToggledKey === shield.key;

          return (
            <StaggerItem key={shield.key}>
              <Kinetic>
                <Card
                  className={cn(
                    "relative overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    active
                      ? "border-green/30 shadow-[0_0_24px_rgba(0,255,136,0.1)] bg-green/[0.04]"
                      : "border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12]"
                  )}
                  {...(active ? greenGlow : {})}
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br transition-opacity duration-500",
                      shield.gradient,
                      active ? "opacity-60" : "opacity-15"
                    )}
                  />

                  {/* Immediate Visual Confirmation Flash Glow on State Change */}
                  <AnimatePresence>
                    {isRecentlyToggled && active && (
                      <motion.div
                        key="flash-glow"
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="absolute inset-0 bg-green/15 pointer-events-none z-1"
                      />
                    )}
                  </AnimatePresence>

                  <div className="relative z-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <motion.div
                          animate={{
                            scale: active ? [1, 1.05, 1] : 1,
                          }}
                          transition={{ duration: 0.3 }}
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300",
                            active
                              ? `bg-${shield.color}/20 text-${shield.color} shadow-[0_0_14px_rgba(0,255,136,0.2)]`
                              : "bg-white/[0.04] text-ink-muted"
                          )}
                        >
                          <shield.icon className="h-5 w-5" />
                        </motion.div>

                        {/* Animated Switch with Instant Confirmation Ripple */}
                        <div className="relative flex items-center">
                          <AnimatePresence>
                            {isRecentlyToggled && (
                              <motion.span
                                key={`ripple-${active}`}
                                initial={{ scale: 0.7, opacity: 0.9 }}
                                animate={{ scale: 1.85, opacity: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className={cn(
                                  "absolute -inset-1 rounded-full border-2 pointer-events-none",
                                  active ? "border-green shadow-[0_0_12px_rgba(0,255,136,0.6)]" : "border-white/40"
                                )}
                              />
                            )}
                          </AnimatePresence>

                          <Switch
                            checked={active}
                            onCheckedChange={(val) => toggle(shield.key, val)}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <h3 className="mb-1 text-sm font-semibold text-ink flex items-center justify-between">
                        <span>{shield.name}</span>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={active ? "status-on" : "status-off"}
                            initial={{ opacity: 0, y: -2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 2 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                              "text-[10px] font-mono uppercase tracking-wider font-bold",
                              active ? "text-green" : "text-ink-faint"
                            )}
                          >
                            {active ? "Online" : "Offline"}
                          </motion.span>
                        </AnimatePresence>
                      </h3>
                      <p className="text-xs leading-relaxed text-ink-muted min-h-[36px]">{shield.desc}</p>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                        <AnimatePresence mode="wait">
                          {active ? (
                            <motion.div
                              key="active-state"
                              initial={{ opacity: 0, scale: 0.94, x: -4 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.94, x: 4 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                              className="flex items-center gap-1.5"
                            >
                              <div className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                              </div>
                              <Badge
                                variant="green"
                                className="text-[10px] font-mono font-bold tracking-wider uppercase py-0.5 shadow-[0_0_10px_rgba(0,255,136,0.25)] border-green/30"
                              >
                                <ShieldCheck className="h-3 w-3 mr-1 text-green shrink-0" />
                                ACTIVE DEFENSE
                              </Badge>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="inactive-state"
                              initial={{ opacity: 0, scale: 0.94, x: -4 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.94, x: 4 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                              className="flex items-center gap-1.5"
                            >
                              <div className="h-2 w-2 rounded-full bg-white/20" />
                              <Badge variant="muted" className="text-[10px] font-mono tracking-wider py-0.5">
                                <ShieldX className="h-3 w-3 mr-1 text-ink-faint shrink-0" />
                                DISENGAGED
                              </Badge>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <span
                          className={cn(
                            "text-[10px] font-mono transition-colors duration-300",
                            active ? "text-green/80 font-medium" : "text-ink-faint"
                          )}
                        >
                          {active ? "REAL-TIME VIGILANCE" : "STANDBY"}
                        </span>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Kinetic>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      <FadeIn delay={0.2}>
        <NativeShieldPanel />
      </FadeIn>
    </div>
  );
}
