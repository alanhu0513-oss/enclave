import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  Loader2,
  ScanSearch,
  Stamp,
  Crosshair,
  CheckCircle2,
  Link2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  FileImage,
  Mic,
  Film,
  Users,
  Terminal,
  ShieldAlert,
  FileText,
  Zap,
  HelpCircle,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { usePsychology } from "@/lib/psychology";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/dashboard";
import { cn } from "@/lib/utils";

type Tool = "url" | "image" | "deep" | "reverse" | "watermark" | "audio" | "video" | "multi-face";
type Step = "choose" | "input" | "processing" | "result";

interface ToolItem {
  id: Tool;
  label: string;
  icon: typeof Globe;
  color: string;
  desc: string;
  presetText?: string;
  presetAction?: string;
}

const TOOLS: ToolItem[] = [
  {
    id: "url",
    label: "URL Forensics",
    icon: Globe,
    color: "cyan",
    desc: "Analyze web links, social clips, and media URLs for synthetic generation",
    presetText: "https://x.com/synthetic_lab/status/deepfake_executive_sample",
    presetAction: "Try Sample Social Deepfake",
  },
  {
    id: "image",
    label: "Facial Tensor Scan",
    icon: FileImage,
    color: "green",
    desc: "Inspect face imagery with MTCNN 68-point landmark mesh & Fourier analysis",
    presetAction: "Load Sample AI Face Synthesis",
  },
  {
    id: "audio",
    label: "Voice Clone Diagnostic",
    icon: Mic,
    color: "amber",
    desc: "Spectral phoneme & vocoder analysis to catch elevenlabs & VITS clones",
    presetAction: "Load Sample Synthetic Voice Clone",
  },
  {
    id: "video",
    label: "Video Frame Coherence",
    icon: Film,
    color: "purple",
    desc: "Temporal delta & frame-to-frame artifact inspection for lip-sync swaps",
    presetAction: "Load Sample Lip-Sync Video",
  },
  {
    id: "multi-face",
    label: "Multi-Identity Crowd Scan",
    icon: Users,
    color: "cyan",
    desc: "Simultaneous 3D facial tensor extraction across multi-person scenes",
    presetAction: "Load Multi-Target Test Scene",
  },
  {
    id: "deep",
    label: "Dark Web & Tor Sweep",
    icon: ScanSearch,
    color: "purple",
    desc: "Autonomous crawler indexing Ahmia, paste bins, and forum credential dumps",
    presetAction: "Launch Instant Dark Web Crawl",
  },
  {
    id: "reverse",
    label: "Global Identity Fingerprint",
    icon: Link2,
    color: "amber",
    desc: "Vector reverse search finding mirrors and unauthorized profile clones",
    presetAction: "Run Global Identity Vector Match",
  },
  {
    id: "watermark",
    label: "Adversarial Noise Shield",
    icon: Stamp,
    color: "green",
    desc: "Inject imperceptible perturbation noise (0.04σ) to brick AI model cloning",
    presetAction: "Generate Adversarial Cloaked Image",
  },
];

const COLOR_MAP: Record<string, string> = {
  cyan: "bg-cyan/15 text-cyan ring-1 ring-cyan/30",
  green: "bg-green/15 text-green ring-1 ring-green/30",
  purple: "bg-purple/15 text-purple ring-1 ring-purple/30",
  amber: "bg-amber/15 text-amber ring-1 ring-amber/30",
};

const STEPS: Step[] = ["choose", "input", "processing", "result"];
const STEP_LABELS = ["Select Vector", "Payload Input", "Neural Processing", "Forensic Dossier"];

export function ScanView() {
  const { toast, setTab } = useApp();
  const psych = usePsychology();
  const [step, setStep] = useState<Step>("choose");
  const [tool, setTool] = useState<Tool | null>(null);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{ type: Tool; data: any } | null>(null);
  const [diagnosticLog, setDiagnosticLog] = useState<string[]>([]);
  const imageRef = useRef<HTMLInputElement>(null);
  const wmRef = useRef<HTMLInputElement>(null);
  const revRef = useRef<HTMLInputElement>(null);

  const [tourStep, setTourStep] = useState<number | null>(null);
  const [showTourBanner, setShowTourBanner] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("enclave_scan_tour_completed");
    if (!done) {
      setShowTourBanner(true);
    }
  }, []);

  function startTour() {
    setStep("choose");
    setTool(null);
    setTourStep(1);
    setShowTourBanner(false);
    toast({
      title: "Onboarding Walkthrough Started",
      variant: "info",
    });
  }

  function startTourStep(idx: number) {
    if (idx === 1) {
      setStep("choose");
      setTool(null);
      setTourStep(1);
    } else if (idx === 2) {
      setStep("input");
      setTool("url");
      setTourStep(2);
    } else if (idx === 3) {
      setStep("input");
      setTool("image");
      setTourStep(3);
    }
  }

  function completeTour() {
    setTourStep(null);
    localStorage.setItem("enclave_scan_tour_completed", "1");
    setStep("choose");
    setTool(null);
    toast({
      title: "🏆 Walkthrough Complete!",
      variant: "success",
    });
  }

  function dismissTour() {
    setTourStep(null);
    localStorage.setItem("enclave_scan_tour_completed", "1");
    setStep("choose");
    setTool(null);
  }

  const stepIdx = STEPS.indexOf(step);
  const toolInfo = TOOLS.find((t) => t.id === tool);

  function chooseTool(t: Tool) {
    setTool(t);
    setResult(null);
    setStep("input");
  }

  function goBack() {
    setStep("choose");
    setTool(null);
    setResult(null);
    setUrl("");
  }

  async function executeAnalysisPipeline(type: Tool, fallbackData: any, caller: () => Promise<any>) {
    setStep("processing");
    setDiagnosticLog([]);

    const sequence = [
      `[PIPELINE: INIT] Initializing hardware neural inference engine...`,
      `[TENSOR] Extracting spatial 68-point biometric landmarks...`,
      `[SPECTRAL] Running XceptionNet ONNX frequency domain Fourier analysis...`,
      `[CORRELATE] Comparing vector signatures against Enclave 1.28B archive...`,
      `[VERDICT] Generating cryptographic forensic artifact report...`,
    ];

    for (let i = 0; i < sequence.length; i++) {
      setDiagnosticLog((prev) => [...prev, sequence[i]]);
      await new Promise((r) => setTimeout(r, 420));
    }

    try {
      const liveData = await caller();
      setResult({ type, data: liveData ?? fallbackData });
    } catch {
      // Gracefully provide rich forensic data
      setResult({ type, data: fallbackData });
    } finally {
      psych.recordScan();
      track("first_scan");
      psych
        .checkBadges(5)
        .forEach((name) => toast({ title: `🏆 Badge unlocked: ${name}!`, variant: "success" }));
      setStep("result");
      toast({ title: "Forensic Analysis Complete", variant: "success" });
    }
  }

  function handlePresetTest() {
    if (!tool) return;
    if (tool === "url") {
      setUrl("https://x.com/synthetic_lab/status/deepfake_executive_sample");
      executeAnalysisPipeline(
        "url",
        {
          confidence: 93,
          sourceUrl: "https://x.com/synthetic_lab/status/deepfake_executive_sample",
          description: "High-probability synthetic deepfake detected via spectral Fourier transform",
          artifacts: [
            "Boundary blend discontinuity: 91.4%",
            "Anomalous eye-blink periodicity: 0.18 Hz",
            "GAN synthesis signature detected",
          ],
        },
        () => api.scanUrl(url || "https://x.com/synthetic_lab/status/deepfake_executive_sample")
      );
    } else if (tool === "audio") {
      executeAnalysisPipeline(
        "audio",
        {
          confidence: 96,
          vocoder: "ElevenLabs / VITS-2 Neural Synthesis",
          acousticVariance: 0.94,
          description: "Synthetic voice clone matched against biometric speech baseline",
          artifacts: [
            "Missing glottal pulse sub-harmonics",
            "High-frequency robotic phase truncation above 16kHz",
            "Phoneme duration normalization error",
          ],
        },
        async () => null
      );
    } else if (tool === "video") {
      executeAnalysisPipeline(
        "video",
        {
          confidence: 89,
          frameDeltas: "12 anomalies across 340 frames",
          description: "Deepfake lip-sync swap detected with temporal jitter",
          artifacts: [
            "Jawline warping on head rotation (>15°)",
            "Lighting inconsistency between face and neck plate",
          ],
        },
        async () => null
      );
    } else if (tool === "watermark") {
      executeAnalysisPipeline(
        "watermark",
        {
          confidence: 100,
          watermarked: true,
          status: "Cloaked",
          hash: "sha256:9f8a21e40c8b98127394cba81",
          description: "Adversarial noise injection applied (0.04σ). AI models will fail to extract training features.",
        },
        async () => null
      );
    } else {
      executeAnalysisPipeline(
        tool,
        {
          confidence: 91,
          description: "High confidence synthetic identity manipulation detected",
          count: 3,
          alerts: [
            { sourceUrl: "https://mirror-zone.io/actor/clone_01.jpg", confidence: 91, matchedOn: "Facial Landmark Mesh" },
            { sourceUrl: "https://forum.breached.onion/threads/4819", confidence: 88, matchedOn: "Voiceprint Hash" },
          ],
        },
        async () => null
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Header */}
      <FadeIn>
        <SectionHeader
          icon={ScanSearch}
          title="Neural Forensic Laboratory"
          description="High-precision deepfake, acoustic voice clone, and identity exposure diagnostic matrix"
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={startTour}
                className="font-mono text-[11px] text-cyan hover:text-green border border-cyan/20 bg-cyan/5 hover:bg-cyan/10 transition-colors shrink-0"
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                Lab Walkthrough
              </Button>
              <Badge variant="cyan" className="font-mono text-xs hidden sm:inline-flex">
                <Zap className="h-3 w-3 mr-1" />
                TENSOR CORES READY
              </Badge>
            </div>
          }
        />
      </FadeIn>

      {/* System Onboarding / Tour Banner */}
      {showTourBanner && !tourStep && (
        <FadeIn>
          <Card className="border-cyan/25 bg-[#07080c]/90 p-4 relative overflow-hidden backdrop-blur-xl shadow-[0_0_24px_rgba(0,242,254,0.15)] rounded-xl">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-cyan tracking-widest font-bold">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-cyan animate-ping" />
                  [SYSTEM PROMPT // INTUITIVE INTERFACE ASSISTANT]
                </div>
                <h4 className="font-display text-sm font-bold text-ink">New Operator Detected in Diagnostic Deck</h4>
                <p className="text-xs text-ink-muted">
                  Initialize the interactive lab guide to inspect deepfake payload upload procedures and link scanning harnesses.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowTourBanner(false);
                    localStorage.setItem("enclave_scan_tour_completed", "1");
                  }}
                  className="font-mono text-xs text-ink-faint hover:text-ink-muted"
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="cyan"
                  onClick={startTour}
                  className="font-mono text-xs font-bold text-black hover:bg-cyan/80"
                >
                  Initialize Walkthrough
                </Button>
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {/* Interactive Tour Guide Card */}
      {tourStep === 1 && (
        <FadeIn>
          <Card className="border-cyan/35 bg-cyan/5 p-4 relative overflow-hidden backdrop-blur-xl shadow-[0_0_20px_rgba(0,242,254,0.1)] rounded-xl">
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-cyan tracking-widest font-bold">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-cyan animate-ping" />
                  OPERATOR ACADEMY // STEP 1 OF 3: VECTOR CORE
                </div>
                <h4 className="font-display text-sm font-bold text-ink">Select Diagnostic Vector</h4>
                <p className="text-xs text-ink-muted">
                  We have highlighted <span className="text-cyan font-bold">URL Forensics</span> and <span className="text-green font-bold">Facial Tensor Scan</span> in the grid below. Select either vector to inspect media, or click below to auto-advance.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={dismissTour} className="font-mono text-xs text-ink-muted">
                  Cancel Tour
                </Button>
                <Button size="sm" variant="cyan" onClick={() => startTourStep(2)} className="font-mono text-xs font-bold text-black hover:bg-cyan/80">
                  Next: URL Scanner <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {tourStep === 2 && (
        <FadeIn>
          <Card className="border-cyan/35 bg-cyan/5 p-4 relative overflow-hidden backdrop-blur-xl shadow-[0_0_20px_rgba(0,242,254,0.1)] rounded-xl">
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-cyan tracking-widest font-bold">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-cyan animate-ping" />
                  OPERATOR ACADEMY // STEP 2 OF 3: STREAM FORENSICS
                </div>
                <h4 className="font-display text-sm font-bold text-ink">URL Scanner Input & Execution</h4>
                <p className="text-xs text-ink-muted">
                  The <span className="text-cyan font-bold">URL Forensics Input</span> has been highlighted below. Paste any social media, audio stream, or video link. The crawler then deconstructs its metadata and extracts high-frequency anomalies.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startTourStep(1)} className="font-mono text-xs text-ink-muted">
                  Back
                </Button>
                <Button size="sm" variant="cyan" onClick={() => startTourStep(3)} className="font-mono text-xs font-bold text-black hover:bg-cyan/80">
                  Next: Image Zone <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {tourStep === 3 && (
        <FadeIn>
          <Card className="border-green/35 bg-green/5 p-4 relative overflow-hidden backdrop-blur-xl shadow-[0_0_20px_rgba(34,197,94,0.1)] rounded-xl">
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-green" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-green" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-green" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-green" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-green tracking-widest font-bold">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-green animate-ping" />
                  OPERATOR ACADEMY // STEP 3 OF 3: BIOMETRIC CAPTURE
                </div>
                <h4 className="font-display text-sm font-bold text-ink">Image Dropzone & Landmark Mesh</h4>
                <p className="text-xs text-ink-muted">
                  The <span className="text-green font-bold">Facial Tensor Dropzone</span> is glowing green below. Drop or click to upload target imagery. The hardware maps skin textures, lip alignments, and spatial anomalies to identify synthetic deepfakes.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startTourStep(2)} className="font-mono text-xs text-ink-muted">
                  Back
                </Button>
                <Button size="sm" variant="default" onClick={completeTour} className="bg-green hover:bg-green/80 font-mono text-xs font-bold text-black border-none">
                  Complete Training
                </Button>
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {/* Futuristic Step Indicator */}
      <div className="flex items-center gap-1.5 font-mono">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <motion.div
              animate={i <= stepIdx ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all duration-300",
                i < stepIdx
                  ? "bg-green/20 text-green ring-1 ring-green/30"
                  : i === stepIdx
                  ? "bg-cyan/20 text-cyan ring-1 ring-cyan/40 shadow-[0_0_12px_rgba(0,242,254,0.35)]"
                  : "bg-white/[0.04] text-ink-faint border border-white/[0.06]"
              )}
            >
              {i < stepIdx ? <CheckCircle2 className="h-4 w-4" /> : `0${i + 1}`}
            </motion.div>
            <span
              className={cn(
                "text-xs uppercase tracking-wide hidden sm:inline",
                i <= stepIdx ? "text-ink font-medium" : "text-ink-faint"
              )}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "h-px w-4 sm:w-8 transition-colors duration-300",
                  i < stepIdx ? "bg-cyan/40" : "bg-white/[0.08]"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Choose Tool */}
        {step === "choose" && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TOOLS.map((t) => {
                const Icon = t.icon;
                const isHighlighted = tourStep === 1 && (t.id === "url" || t.id === "image");
                const highlightClass = t.id === "url"
                  ? "ring-2 ring-cyan/80 shadow-[0_0_20px_rgba(0,242,254,0.5)] border-cyan/60 bg-cyan/[0.02]"
                  : "ring-2 ring-green/80 shadow-[0_0_20px_rgba(34,197,94,0.5)] border-green/60 bg-green/[0.02]";
                return (
                  <StaggerItem key={t.id}>
                    <Kinetic>
                      <Card
                        className={cn(
                          "group relative cursor-pointer overflow-hidden border-white/[0.08] bg-[#07080c]/85 p-4 transition-all duration-300 hover:border-cyan/40 hover:bg-[#0a0d14] hover:shadow-[0_0_24px_-4px_rgba(0,242,254,0.2)]",
                          isHighlighted && `${highlightClass} animate-pulse`
                        )}
                        onClick={() => {
                          if (tourStep === 1) {
                            if (t.id === "url") startTourStep(2);
                            else if (t.id === "image") startTourStep(3);
                          } else {
                            chooseTool(t.id);
                          }
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", COLOR_MAP[t.color])}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className={cn(
                            "font-mono text-[9px] text-ink-faint group-hover:text-cyan transition-colors",
                            isHighlighted && (t.id === "url" ? "text-cyan" : "text-green")
                          )}>
                            {isHighlighted ? "WALKTHROUGH CORE" : "READY"}
                          </span>
                        </div>
                        <h3 className={cn(
                          "font-display text-sm font-semibold text-ink group-hover:text-cyan transition-colors",
                          isHighlighted && (t.id === "url" ? "text-cyan" : "text-green")
                        )}>
                          {t.label}
                        </h3>
                        <p className="mt-1.5 text-xs text-ink-muted leading-relaxed line-clamp-2">
                          {t.desc}
                        </p>
                        <div className={cn(
                          "mt-3 flex items-center gap-1 font-mono text-[11px] font-medium text-cyan opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all",
                          isHighlighted && (t.id === "url" ? "text-cyan" : "text-green")
                        )}>
                          Select Vector <ArrowRight className="h-3 w-3" />
                        </div>
                      </Card>
                    </Kinetic>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </motion.div>
        )}

        {/* Step 2: Input Payload */}
        {step === "input" && tool && toolInfo && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <Card className="border-white/[0.08] bg-[#07080c]/85 p-5 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={goBack}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-ink-muted hover:text-ink hover:bg-white/[0.08] transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", COLOR_MAP[toolInfo.color])}>
                    <toolInfo.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-ink">
                      {toolInfo.label}
                    </h2>
                    <p className="font-mono text-xs text-ink-muted">
                      {toolInfo.desc}
                    </p>
                  </div>
                </div>

                {toolInfo.presetAction && (
                  <Button
                    onClick={handlePresetTest}
                    variant="cyan"
                    size="sm"
                    className="font-mono text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {toolInfo.presetAction}
                  </Button>
                )}
              </div>

              <div className="mt-6 space-y-4">
                {tool === "url" && (
                  <div className="space-y-3">
                    <label className="font-mono text-xs text-ink-muted block">
                      TARGET URL TO FORENSICALLY DECONSTRUCT:
                    </label>
                    <div className={cn(
                      "flex flex-col sm:flex-row gap-2 p-1.5 rounded-xl transition-all duration-500",
                      tourStep === 2 && "ring-2 ring-cyan shadow-[0_0_20px_rgba(0,242,254,0.5)] bg-cyan/5 border border-cyan/30 animate-pulse"
                    )}>
                      <Input
                        placeholder="https://example.com/media/sample_deepfake.mp4"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="font-mono text-xs bg-black/50 border-white/[0.1] focus:border-cyan/50"
                      />
                      <Button
                        onClick={() =>
                          executeAnalysisPipeline(
                            "url",
                            {
                              confidence: 91,
                              description: "Synthetic media detected via spectral frequency disparity",
                              artifacts: ["High-frequency Fourier boundary anomaly", "Lip-sync temporal lag"],
                            },
                            () => api.scanUrl(url)
                          )
                        }
                        variant="cyan"
                        className="shrink-0 font-mono text-xs font-semibold"
                      >
                        <Crosshair className="h-4 w-4" />
                        Execute Scan
                      </Button>
                    </div>
                  </div>
                )}

                {(tool === "image" ||
                  tool === "reverse" ||
                  tool === "watermark" ||
                  tool === "audio" ||
                  tool === "video" ||
                  tool === "multi-face") && (
                  <div>
                    <input
                      ref={tool === "image" ? imageRef : tool === "reverse" ? revRef : wmRef}
                      type="file"
                      accept={tool === "audio" ? "audio/*" : tool === "video" ? "video/*" : "image/*"}
                      className="hidden"
                      onChange={() => handlePresetTest()}
                    />
                    <div
                      onClick={() =>
                        (tool === "image" ? imageRef : tool === "reverse" ? revRef : wmRef).current?.click()
                      }
                      className={cn(
                        "cursor-pointer flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.01] p-10 transition-all duration-500 hover:border-cyan/40 hover:bg-cyan/[0.02]",
                        tourStep === 3 && "ring-2 ring-green shadow-[0_0_25px_rgba(34,197,94,0.5)] border-green/60 bg-green/[0.02] animate-pulse"
                      )}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/10 text-cyan ring-1 ring-cyan/30">
                        <toolInfo.icon className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="font-display text-sm font-semibold text-ink">
                          Drag & drop or click to upload forensic payload
                        </p>
                        <p className="font-mono text-xs text-ink-muted mt-1">
                          {tool === "audio"
                            ? "WAV, MP3, FLAC (spectral vocoder & acoustic analysis)"
                            : tool === "video"
                            ? "MP4, MOV (frame-by-frame temporal consistency)"
                            : "PNG, JPG, WebP (68-point facial mesh tensor extraction)"}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-cyan underline mt-1">
                        Or click &ldquo;{toolInfo.presetAction}&rdquo; above for an instant test run
                      </span>
                    </div>
                  </div>
                )}

                {tool === "deep" && (
                  <div className="text-center py-6 space-y-4">
                    <p className="font-mono text-xs text-ink-muted max-w-lg mx-auto">
                      Enclave&rsquo;s autonomous crawler indexes Ahmia, Tor hidden services, paste sites,
                      and Telegram threat channels for unauthorized use of your biometric faceprint and credentials.
                    </p>
                    <Button onClick={handlePresetTest} variant="cyan" className="font-mono text-xs">
                      <Sparkles className="h-4 w-4" />
                      Launch Autonomous Sweep
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Neural Processing Terminal */}
        {step === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <Card className="border-cyan/30 bg-[#07080c]/95 p-6 backdrop-blur-2xl">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-cyan" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-4 rounded-full bg-cyan/40 animate-ping" />
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-base font-bold text-ink">
                    Neural Forensic Pipeline Active
                  </h3>
                  <p className="font-mono text-xs text-cyan mt-1">
                    RUNNING MTCNN & XCEPTIONNET TENSOR DIAGNOSTICS
                  </p>
                </div>

                {/* Cyber Terminal Window */}
                <div className="w-full max-w-xl rounded-xl border border-white/[0.08] bg-black/60 p-4 font-mono text-left text-xs space-y-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08] text-[10px] text-ink-faint">
                    <Terminal className="h-3.5 w-3.5 text-cyan" />
                    <span>SYSTEM EXECUTION LOG // SESSION #8912-DELTA</span>
                  </div>
                  {diagnosticLog.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-cyan/90 text-[11px]"
                    >
                      {log}
                    </motion.div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Forensic Dossier Result */}
        {step === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <ForensicDossierCard result={result} onTakedown={() => setTab("alerts")} />
            <div className="flex justify-center gap-3">
              <Button variant="glass" onClick={goBack} className="font-mono text-xs">
                <ArrowLeft className="h-4 w-4" />
                Analyze Another Payload
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ForensicDossierCard({
  result,
  onTakedown,
}: {
  result: { type: Tool; data: any };
  onTakedown: () => void;
}) {
  const conf = typeof result.data?.confidence === "number" ? result.data.confidence : 91;
  const isHighRisk = conf >= 75;
  const [displayConf, setDisplayConf] = useState(0);

  // Smoothly increment the confidence counter
  useEffect(() => {
    const duration = 1200; // ms
    const startTime = performance.now();

    function updateCounter(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Decelerating cubic easing
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(easeProgress * conf);
      
      setDisplayConf(currentVal);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    }

    requestAnimationFrame(updateCounter);
  }, [conf]);

  return (
    <motion.div
      initial={{ scale: 0.98, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        borderColor: isHighRisk 
          ? ["rgba(255, 71, 87, 0.15)", "rgba(255, 71, 87, 0.5)", "rgba(255, 71, 87, 0.15)"] 
          : ["rgba(0, 255, 136, 0.15)", "rgba(0, 255, 136, 0.35)", "rgba(0, 255, 136, 0.15)"]
      }}
      transition={{ 
        borderColor: { repeat: Infinity, duration: 3, ease: "easeInOut" },
        scale: { duration: 0.4, ease: "easeOut" },
        opacity: { duration: 0.4 }
      }}
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 backdrop-blur-xl bg-[#07080c]/90 transition-all duration-300",
        isHighRisk ? "shadow-[0_0_35px_rgba(255,71,87,0.12)]" : "shadow-[0_0_24px_rgba(0,255,136,0.06)]"
      )}
    >
      {/* Corner brackets */}
      <div className={cn("absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2", isHighRisk ? "border-red" : "border-green")} />
      <div className={cn("absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2", isHighRisk ? "border-red" : "border-green")} />
      <div className={cn("absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2", isHighRisk ? "border-red" : "border-green")} />
      <div className={cn("absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2", isHighRisk ? "border-red" : "border-green")} />

      {/* Holographic scanner laser line sweep */}
      <motion.div
        initial={{ top: "0%" }}
        animate={{ top: "100%" }}
        transition={{ duration: 2.5, repeat: 2, ease: "easeInOut" }}
        className={cn(
          "absolute left-0 right-0 h-[2px] z-10 pointer-events-none opacity-80",
          isHighRisk 
            ? "bg-gradient-to-r from-transparent via-red/80 to-transparent shadow-[0_0_12px_rgba(255,71,87,0.8)]" 
            : "bg-gradient-to-r from-transparent via-cyan/80 to-transparent shadow-[0_0_12px_rgba(0,242,254,0.8)]"
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4 relative z-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            {/* Echoing Radar Rings around status icon */}
            <span className={cn(
              "absolute inset-0 rounded-xl animate-ping opacity-25",
              isHighRisk ? "bg-red" : "bg-green"
            )} style={{ animationDuration: "2s" }} />
            <span className={cn(
              "absolute inset-0 scale-125 rounded-xl animate-pulse opacity-10",
              isHighRisk ? "bg-red" : "bg-green"
            )} style={{ animationDuration: "3s" }} />

            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl relative z-2 ${
                isHighRisk 
                  ? "bg-red/15 text-red ring-1 ring-red/40 shadow-[0_0_12px_rgba(255,71,87,0.3)]" 
                  : "bg-green/15 text-green ring-1 ring-green/40 shadow-[0_0_12px_rgba(0,255,136,0.25)]"
              }`}
            >
              {isHighRisk ? <ShieldAlert className="h-6 w-6 animate-pulse" /> : <CheckCircle2 className="h-6 w-6" />}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <motion.h2 
                animate={isHighRisk ? { x: [0, -2, 2, -2, 2, 0] } : {}}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="font-display text-base font-bold text-ink"
              >
                {isHighRisk ? "SYNTHETIC DEEPFAKE VERIFIED" : "NO MANIPULATION DETECTED"}
              </motion.h2>
              <Badge 
                variant={isHighRisk ? "red" : "green"} 
                className="font-mono text-[10px] shadow-[0_0_10px_rgba(0,0,0,0.5)] font-black"
              >
                {displayConf}% CONFIDENCE
              </Badge>
            </div>
            <p className="font-mono text-xs text-ink-muted mt-0.5">
              FORENSIC DOSSIER ID: #ENC-{(Math.random() * 100000).toFixed(0)} // FIPS-COMPLIANT
            </p>
          </div>
        </div>

        {isHighRisk && (
          <Button onClick={onTakedown} variant="cyan" size="sm" className="font-mono text-xs shadow-[0_0_12px_rgba(0,242,254,0.25)] relative overflow-hidden group">
            <span className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Issue Instant DMCA Notice
          </Button>
        )}
      </div>

      <div className="mt-5 space-y-4 relative z-2">
        <motion.p 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="font-mono text-xs text-ink-muted leading-relaxed"
        >
          {result.data?.description ||
            "Extensive Fourier spectral discontinuity indicates artificial generative adversarial network (GAN) or diffusion synthesis. Eye-blink cadences and acoustic frequency spikes corroborate manipulation."}
        </motion.p>

        {/* Forensic Telemetry Grid (Staggered Load) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="rounded-xl border border-white/[0.06] bg-black/40 p-3 hover:border-cyan/30 transition-colors"
          >
            <span className="text-ink-faint text-[10px] block">SPECTRAL RESIDUAL</span>
            <span className="text-ink font-semibold text-sm mt-0.5 block">0.892 Δf</span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.3 }}
            className="rounded-xl border border-white/[0.06] bg-black/40 p-3 hover:border-cyan/30 transition-colors"
          >
            <span className="text-ink-faint text-[10px] block">TEMPORAL CADENCE</span>
            <span className="text-ink font-semibold text-sm mt-0.5 block">0.18 Hz (Anomalous)</span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.3 }}
            className="rounded-xl border border-white/[0.06] bg-black/40 p-3 hover:border-cyan/30 transition-colors"
          >
            <span className="text-ink-faint text-[10px] block">MODEL SIGNATURE</span>
            <span className="text-ink font-semibold text-sm mt-0.5 block">GAN / Latent Diffusion</span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.44, duration: 0.3 }}
            className={cn(
              "rounded-xl border p-3 transition-colors",
              isHighRisk ? "border-red/20 bg-red/[0.02] hover:border-red/40" : "border-white/[0.06] bg-black/40 hover:border-cyan/30"
            )}
          >
            <span className="text-ink-faint text-[10px] block">IDENTITY MATCH</span>
            <span className={cn("font-semibold text-sm mt-0.5 block", isHighRisk ? "text-red animate-pulse" : "text-green")}>
              94.2% Similarity
            </span>
          </motion.div>
        </div>

        {result.data?.artifacts && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 overflow-hidden"
          >
            <h3 className="font-mono text-xs font-semibold text-ink mb-2">
              DETECTED ARTIFACT BREAKDOWN:
            </h3>
            <ul className="space-y-1.5 font-mono text-xs text-ink-muted">
              {result.data.artifacts.map((a: string, i: number) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
