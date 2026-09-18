import { useState, useEffect } from "react";
import { Eye, Radar, Lock, FileText, ShieldCheck, ArrowRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-context";
import { getShieldStates } from "@/features/shields/shields-view";

const SHIELDS_STORAGE_KEY = "enclave_shields_state";

interface ShieldSpec {
  key: string;
  name: string;
  codename: string;
  desc: string;
  icon: typeof Eye;
  accent: string;
  telemetry: string;
}

const SHIELD_SPECS: ShieldSpec[] = [
  {
    key: "crawler",
    name: "Proactive Web Crawler",
    codename: "DEF-01 // CRAWL",
    desc: "Autonomous crawler indexing surface, social, and search engines for unauthorized identity mirrors.",
    icon: Eye,
    accent: "text-cyan",
    telemetry: "1.28B NODES INDEXED",
  },
  {
    key: "monitor",
    name: "Darknet & Stealer Sentinel",
    codename: "DEF-02 // SENTINEL",
    desc: "Real-time feed ingesting RedLine, Lumma, and Telegram malware bot logs to detect credential theft.",
    icon: Radar,
    accent: "text-purple",
    telemetry: "TOR EXIT HOOKED",
  },
  {
    key: "biometric",
    name: "Homomorphic Biometric Vault",
    codename: "DEF-03 // CRYPTO",
    desc: "Zero-knowledge 256-bit encrypted faceprint & voiceprint embeddings for continuous matching.",
    icon: Lock,
    accent: "text-green",
    telemetry: "FIPS-140-2 LEVEL 3",
  },
  {
    key: "takedown",
    name: "Autonomous DMCA Takedown",
    codename: "DEF-04 // STRIKE",
    desc: "Automated legal notice generation and direct dispatch to platform abuse desks within 60 seconds.",
    icon: FileText,
    accent: "text-amber",
    telemetry: "48H ESCALATION ACTIVE",
  },
  {
    key: "rights",
    name: "Immunity Noise Injection",
    codename: "DEF-05 // CLOAK",
    desc: "Imperceptible adversarial noise injection preventing AI models from training or cloning your media.",
    icon: ShieldCheck,
    accent: "text-cyan",
    telemetry: "PERTURBATION 0.04σ",
  },
];

export function ShieldArrayMatrix({ onStateChange }: { onStateChange?: (activeCount: number) => void }) {
  const { toast, setTab } = useApp();
  const [toggles, setToggles] = useState<Record<string, boolean>>(getShieldStates);

  useEffect(() => {
    localStorage.setItem(SHIELDS_STORAGE_KEY, JSON.stringify(toggles));
    const active = Object.values(toggles).filter(Boolean).length;
    onStateChange?.(active);
  }, [toggles, onStateChange]);

  const handleToggle = (key: string, val: boolean, name: string) => {
    setToggles((prev) => ({ ...prev, [key]: val }));
    toast({
      title: val ? `${name} Armed` : `${name} Standby`,
      body: val ? "Defense layer engaged with real-time telemetry." : "Defense layer placed in idle mode.",
      variant: val ? "success" : "info",
    });
  };

  const activeCount = Object.values(toggles).filter(Boolean).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07080c]/85 p-4 sm:p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan/15 text-cyan ring-1 ring-cyan/30">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold tracking-wide text-ink">
              ACTIVE DEFENSE ARRAY
            </h2>
            <p className="font-mono text-[11px] text-ink-muted">
              {activeCount} OF {SHIELD_SPECS.length} LAYERS ARMED // ZERO-TRUST FIREWALL
            </p>
          </div>
        </div>

        <button
          onClick={() => setTab("shield")}
          className="flex items-center gap-1 font-mono text-[11px] text-cyan hover:text-green transition-colors"
        >
          Configure Array <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SHIELD_SPECS.map((spec) => {
          const Icon = spec.icon;
          const isActive = toggles[spec.key] ?? false;

          return (
            <div
              key={spec.key}
              className={`group relative flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-200 ${
                isActive
                  ? "border-cyan/30 bg-cyan/[0.03] shadow-[0_0_20px_-8px_rgba(0,242,254,0.12)]"
                  : "border-white/[0.06] bg-white/[0.01] opacity-75"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[9px] text-ink-faint tracking-wider">
                    {spec.codename}
                  </span>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(val) => handleToggle(spec.key, val, spec.name)}
                    aria-label={`Toggle ${spec.name}`}
                  />
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                      isActive ? "bg-cyan/15 text-cyan" : "bg-white/[0.05] text-ink-faint"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-display text-xs font-semibold text-ink">
                    {spec.name}
                  </h3>
                </div>

                <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2">
                  {spec.desc}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2 font-mono text-[9px]">
                <span className="text-ink-faint">STATUS:</span>
                <span className={isActive ? "text-green font-semibold" : "text-ink-faint"}>
                  {isActive ? "● ARMED & RUNNING" : "○ STANDBY"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
