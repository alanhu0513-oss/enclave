import { useState } from "react";
import { Radar, Crosshair, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";

interface ThreatBlip {
  id: string;
  label: string;
  source: string;
  vector: "voice" | "deepfake" | "stealer" | "crawler";
  confidence: number;
  x: number; // percentage from center
  y: number; // percentage from center
  timestamp: string;
  status: "active" | "neutralized" | "escalated";
  details: string;
}

const SAMPLE_THREATS: ThreatBlip[] = [
  {
    id: "th-1",
    label: "Synthetic Voice Sample",
    source: "Telegram VoIP Audio Feed",
    vector: "voice",
    confidence: 94,
    x: 32,
    y: 24,
    timestamp: "6m ago",
    status: "active",
    details: "Acoustic clone matched against enrolled biometric voice profile. 0.94 probability of synthetic neural vocoder.",
  },
  {
    id: "th-2",
    label: "Deepfake Video Clip",
    source: "X / Twitter Media Proxy",
    vector: "deepfake",
    confidence: 89,
    x: 74,
    y: 68,
    timestamp: "24m ago",
    status: "active",
    details: "Facial landmark tensor mismatch at 68-point mesh perimeter. Artificial eye-blink periodicity detected.",
  },
  {
    id: "th-3",
    label: "Infostealer Log Match",
    source: "Darknet RedLine / Lumma Corpus",
    vector: "stealer",
    confidence: 98,
    x: 28,
    y: 78,
    timestamp: "1h ago",
    status: "active",
    details: "Leaked session credentials and cookies found in threat actor dump. Zero-trust token revocation recommended.",
  },
  {
    id: "th-4",
    label: "Unauthorized Web Mirror",
    source: "DuckDuckGo / Ahmia Mirror",
    vector: "crawler",
    confidence: 76,
    x: 65,
    y: 28,
    timestamp: "3h ago",
    status: "neutralized",
    details: "Crawled mirror replicating identity portfolio. Rights watermarking verified ownership.",
  },
];

export function ThreatRadarHUD() {
  const { setTab, toast } = useApp();
  const [selectedBlip, setSelectedBlip] = useState<ThreatBlip | null>(SAMPLE_THREATS[0]);
  const [threats, setThreats] = useState<ThreatBlip[]>(SAMPLE_THREATS);

  const handleNeutralize = (id: string) => {
    setThreats((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "neutralized" } : t))
    );
    if (selectedBlip?.id === id) {
      setSelectedBlip((prev) => prev ? { ...prev, status: "neutralized" } : null);
    }
    toast({
      title: "Threat Neutralized",
      body: "Blast radius isolated. Token revoked and takedown filed.",
      variant: "success",
    });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-[#080a0f]/90 backdrop-blur-xl p-4 sm:p-5">
      {/* Background cyber grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.06)_0%,transparent_75%)]" />

      {/* Header */}
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-cyan/15 text-cyan ring-1 ring-cyan/30">
            <Radar className="h-4 w-4 animate-spin" style={{ animationDuration: "10s" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm font-semibold tracking-wide text-ink">
                LIVE THREAT RADAR
              </h2>
              <Badge variant="cyan" className="text-[10px] uppercase font-mono py-0 px-1.5">
                ● Sweeping
              </Badge>
            </div>
            <p className="font-mono text-[11px] text-ink-muted">
              SECTOR 07 // 360° SPATIAL & TELEMETRY SURVEILLANCE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-faint">
          <span>LAT: 37.7749° N</span>
          <span className="text-white/20">|</span>
          <span className="text-cyan">{threats.filter(t => t.status === "active").length} ACTIVE THREATS</span>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[1.1fr_1fr] items-center">
        {/* Visual Radar Scope */}
        <div className="relative mx-auto aspect-square w-full max-w-[280px] sm:max-w-[320px] select-none">
          {/* Radar Circles */}
          <div className="absolute inset-0 rounded-full border border-cyan/20" />
          <div className="absolute inset-[15%] rounded-full border border-cyan/15 border-dashed" />
          <div className="absolute inset-[32%] rounded-full border border-cyan/20" />
          <div className="absolute inset-[50%] rounded-full border border-cyan/25" />
          <div className="absolute inset-[68%] rounded-full border border-cyan/20" />

          {/* Crosshairs */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-cyan/20" />
          <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-cyan/20" />

          {/* Diagonal guides */}
          <div className="absolute left-0 right-0 top-1/2 h-px -rotate-45 bg-cyan/10" />
          <div className="absolute left-0 right-0 top-1/2 h-px rotate-45 bg-cyan/10" />

          {/* Sweeping radar beam */}
          <div className="hud-radar-sweep" />

          {/* Center Point */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-cyan shadow-[0_0_12px_#00F2FE]" />
            <div className="absolute h-8 w-8 rounded-full border border-cyan/40 animate-ping" />
          </div>

          {/* Threat Blips */}
          {threats.map((threat) => {
            const isSelected = selectedBlip?.id === threat.id;
            const isNeutralized = threat.status === "neutralized";
            return (
              <button
                key={threat.id}
                onClick={() => setSelectedBlip(threat)}
                style={{ left: `${threat.x}%`, top: `${threat.y}%` }}
                className="group absolute -translate-x-1/2 -translate-y-1/2 p-1.5 focus:outline-none"
                title={`${threat.label} (${threat.confidence}%)`}
              >
                <div className="relative flex items-center justify-center">
                  <span
                    className={`h-3 w-3 rounded-full transition-transform duration-200 group-hover:scale-150 ${
                      isNeutralized
                        ? "bg-green shadow-[0_0_8px_#0df294]"
                        : threat.confidence >= 90
                        ? "bg-red animate-pulse shadow-[0_0_12px_#ff2d55]"
                        : "bg-amber shadow-[0_0_10px_#ffb800]"
                    } ${isSelected ? "ring-2 ring-white scale-125" : ""}`}
                  />
                  {!isNeutralized && (
                    <span className="absolute -inset-1 rounded-full border border-current opacity-40 animate-ping" />
                  )}
                  {/* Micro label */}
                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] text-ink-muted group-hover:text-ink">
                    {threat.confidence}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Threat Diagnostic Panel */}
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 font-mono text-xs">
          {selectedBlip ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        selectedBlip.status === "neutralized"
                          ? "bg-green"
                          : selectedBlip.confidence >= 90
                          ? "bg-red animate-pulse"
                          : "bg-amber"
                      }`}
                    />
                    <span className="font-display font-semibold text-ink text-sm">
                      {selectedBlip.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-ink-faint">
                    ORIGIN: {selectedBlip.source}
                  </span>
                </div>
                <Badge
                  variant={
                    selectedBlip.status === "neutralized"
                      ? "green"
                      : selectedBlip.confidence >= 90
                      ? "red"
                      : "amber"
                  }
                  className="text-[10px] font-mono shrink-0"
                >
                  {selectedBlip.status === "neutralized"
                    ? "NEUTRALIZED"
                    : `${selectedBlip.confidence}% THREAT`}
                </Badge>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-black/40 p-2.5 text-ink-muted text-[11px] leading-relaxed">
                {selectedBlip.details}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-faint">
                <div className="rounded bg-white/[0.03] p-1.5">
                  VECTOR: <span className="text-ink uppercase">{selectedBlip.vector}</span>
                </div>
                <div className="rounded bg-white/[0.03] p-1.5">
                  TIME: <span className="text-ink">{selectedBlip.timestamp}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {selectedBlip.status !== "neutralized" ? (
                  <Button
                    size="sm"
                    variant="cyan"
                    className="flex-1 text-xs"
                    onClick={() => handleNeutralize(selectedBlip.id)}
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Neutralize Threat
                  </Button>
                ) : (
                  <div className="flex flex-1 items-center justify-center gap-1.5 py-1 text-green text-xs font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Protected & Contained
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setTab("alerts")}
                >
                  <FileText className="h-3.5 w-3.5" />
                  DMCA Notice
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-ink-faint">
              <Crosshair className="h-8 w-8 mb-2 opacity-50" />
              <span>Select any radar coordinate to inspect intercepted telemetry</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
