import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  ImagePlus,
  Loader2,
  ScanSearch,
  Stamp,
  Crosshair,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  FileImage,
  Mic,
  Film,
  Users,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { usePsychology } from "@/lib/psychology";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn } from "@/components/ui/motion";
import { buttonPulse } from "@/lib/motion-presets";
import { SectionHeader } from "@/components/ui/dashboard";
import { confidenceColor, confidenceLabel, cn } from "@/lib/utils";

type Tool = "url" | "image" | "deep" | "reverse" | "watermark" | "audio" | "video" | "multi-face";
type Step = "choose" | "input" | "processing" | "result";

const TOOLS: { id: Tool; label: string; icon: typeof Globe; color: string; desc: string }[] = [
  { id: "url", label: "Scan a URL", icon: Globe, color: "cyan", desc: "Paste a link and we'll analyze it for deepfakes" },
  { id: "image", label: "Scan an Image", icon: FileImage, color: "green", desc: "Upload a photo to check if it's a deepfake" },
  { id: "audio", label: "Audio Analysis", icon: Mic, color: "amber", desc: "Detect AI-generated or cloned voice audio" },
  { id: "video", label: "Video Analysis", icon: Film, color: "purple", desc: "Analyze video frames for manipulation" },
  { id: "multi-face", label: "Multi-Face Detect", icon: Users, color: "cyan", desc: "Detect and analyze multiple faces in an image" },
  { id: "deep", label: "Deep Web Crawl", icon: ScanSearch, color: "purple", desc: "Actively search the web & dark web for your face" },
  { id: "reverse", label: "Reverse Image Search", icon: Link2, color: "amber", desc: "Find where an image appears across the web" },
  { id: "watermark", label: "Rights Shield", icon: Stamp, color: "green", desc: "Embed an invisible watermark to prove ownership" },
];

const COLOR_MAP: Record<string, string> = {
  cyan: "bg-cyan/15 text-cyan",
  green: "bg-green/15 text-green",
  purple: "bg-purple/15 text-purple",
  amber: "bg-amber/15 text-amber",
};

const STEPS: Step[] = ["choose", "input", "processing", "result"];
const STEP_LABELS = ["Choose", "Input", "Processing", "Result"];

export function ScanView() {
  const { toast } = useApp();
  const psych = usePsychology();
  const [step, setStep] = useState<Step>("choose");
  const [tool, setTool] = useState<Tool | null>(null);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{ type: Tool; data: any } | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const wmRef = useRef<HTMLInputElement>(null);
  const revRef = useRef<HTMLInputElement>(null);

  const stepIdx = STEPS.indexOf(step);
  const toolInfo = TOOLS.find((t) => t.id === tool);

  function chooseTool(t: Tool) {
    setTool(t);
    setResult(null);
    setStep("input");
  }

  function goBack() {
    if (step === "input") {
      setStep("choose");
      setTool(null);
      setUrl("");
    } else if (step === "result") {
      setStep("choose");
      setTool(null);
      setResult(null);
      setUrl("");
    }
  }

  async function runScan() {
    if (tool === "url" && !url) {
      toast({ title: "Enter a URL", variant: "info" });
      return;
    }
    setStep("processing");
    try {
      let data: any;
      if (tool === "url") {
        data = await api.scanUrl(url);
      }
      setResult({ type: tool!, data });
      psych.recordScan();
      track("first_scan");
      psych
        .checkBadges(5)
        .forEach((name) => toast({ title: `🏆 Badge unlocked: ${name}!`, variant: "success" }));
      setStep("result");
      toast({ title: "Scan complete", variant: "success" });
    } catch (e: any) {
      toast({ title: "Scan failed", body: e.message, variant: "error" });
      setStep("input");
    }
  }

  async function handleFile(file: File) {
    setStep("processing");
    try {
      let data: any;
      if (tool === "image") {
        data = await api.scanImage(file);
      } else if (tool === "reverse") {
        data = await api.reverseImageSearch(file);
      } else if (tool === "watermark") {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        data = await api.embedWatermark(base64);
      } else if (tool === "audio") {
        data = await api.detectAudio(file);
      } else if (tool === "video") {
        data = await api.detectVideo(file);
      } else if (tool === "multi-face") {
        data = await api.detectMultiFace(file);
      }
      setResult({ type: tool!, data });
      psych.recordScan();
      track("first_scan");
      psych
        .checkBadges(5)
        .forEach((name) => toast({ title: `🏆 Badge unlocked: ${name}!`, variant: "success" }));
      setStep("result");
      const label = tool === "watermark" ? "Watermark embedded" : "Analysis complete";
      toast({ title: label, variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
      setStep("input");
    }
  }

  async function runDeepScan() {
    setStep("processing");
    toast({ title: "Deep scan started", body: "This may take a few minutes", variant: "info" });
    try {
      const data = await api.deepScan();
      setResult({ type: "deep", data });
      setStep("result");
      toast({ title: "Deep scan complete", variant: "success" });
    } catch (e: any) {
      toast({ title: "Deep scan failed", body: e.message, variant: "error" });
      setStep("input");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Header */}
      <FadeIn>
        <SectionHeader
          icon={ScanSearch}
          title="Deep Scan"
          description="Detect deepfakes & unauthorized use of your identity"
        />
      </FadeIn>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <motion.div
              animate={i <= stepIdx ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.4 }}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                i < stepIdx ? "bg-green/20 text-green" :
                i === stepIdx ? "bg-cyan/20 text-cyan shadow-[0_0_12px_rgba(0,191,255,0.3)]" :
                "bg-white/[0.04] text-ink-faint"
              )}
            >
              {i < stepIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </motion.div>
            <span className={cn("text-xs font-medium", i <= stepIdx ? "text-ink" : "text-ink-faint")}>{label}</span>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn(
                "h-px w-6 transition-colors duration-300",
                i < stepIdx ? "bg-green/40" : "bg-white/[0.06]"
              )} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Choose tool */}
        {step === "choose" && (
          <motion.div key="choose" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((t) => {
                const Icon = t.icon;
                const gradients: Record<string, string> = {
                  cyan: "from-cyan/10 to-blue/10",
                  green: "from-green/10 to-emerald/10",
                  purple: "from-purple/10 to-pink/10",
                  amber: "from-amber/10 to-orange/10",
                };
                return (
                  <StaggerItem key={t.id}>
                    <Kinetic>
                      <Card
                        className="group cursor-pointer relative overflow-hidden border-white/[0.06] transition-all duration-300 hover:border-cyan/40 hover:shadow-lg hover:shadow-cyan/5"
                        onClick={() => chooseTool(t.id)}
                      >
                        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100", gradients[t.color])} />
                        <CardContent className="relative p-5">
                          <div className={cn("mb-3 flex h-11 w-11 items-center justify-center rounded-xl", COLOR_MAP[t.color])}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="text-sm font-semibold text-ink">{t.label}</p>
                          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t.desc}</p>
                          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-cyan opacity-0 transition-opacity group-hover:opacity-100">
                            Get started <ArrowRight className="h-3 w-3" />
                          </div>
                        </CardContent>
                      </Card>
                    </Kinetic>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </motion.div>
        )}

        {/* Step 2: Input */}
        {step === "input" && tool && (
          <motion.div key="input" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <button onClick={goBack} className="rounded-lg bg-white/[0.04] p-1.5 text-ink-muted hover:text-ink">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", COLOR_MAP[toolInfo?.color || "cyan"])}>
                    {toolInfo && <toolInfo.icon className="h-4.5 w-4.5" />}
                  </div>
                  <div>
                    <CardTitle>{toolInfo?.label}</CardTitle>
                    <CardDescription>{toolInfo?.desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tool === "url" && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/article"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runScan()}
                      autoFocus
                    />
                    <motion.div {...buttonPulse}>
                      <Button onClick={runScan} className="shrink-0">
                        <Crosshair className="h-4 w-4" />
                        Scan
                      </Button>
                    </motion.div>
                  </div>
                )}

                {(tool === "image" || tool === "reverse" || tool === "watermark" || tool === "audio" || tool === "video" || tool === "multi-face") && (
                  <div>
                    <input
                      ref={tool === "image" ? imageRef : tool === "reverse" ? revRef : wmRef}
                      type="file"
                      accept={
                        tool === "audio" ? "audio/*" :
                        tool === "video" ? "video/*" :
                        "image/*"
                      }
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                    />
                    <button
                      onClick={() =>
                        (tool === "image" ? imageRef : tool === "reverse" ? revRef : wmRef).current?.click()
                      }
                      className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-8 transition-colors hover:border-cyan/40 hover:bg-cyan/[0.03]"
                    >
                      <ImagePlus className="h-8 w-8 text-ink-faint" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-ink">Click to upload</p>
                        <p className="text-xs text-ink-muted">
                          {tool === "audio" ? "MP3, WAV, OGG up to 25MB" :
                           tool === "video" ? "MP4, MOV, AVI up to 50MB" :
                           "PNG, JPG up to 10MB"}
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {tool === "deep" && (
                  <div className="text-center">
                    <p className="mb-4 text-sm text-ink-muted">
                      This will search the surface web, Reddit, paste sites, and dark web for your identity.
                      It may take several minutes.
                    </p>
                    <Button onClick={runDeepScan}>
                      <Sparkles className="h-4 w-4" />
                      Start Deep Scan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-12">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-cyan" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-6 w-6 rounded-full bg-cyan/20" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-ink">
                    {tool === "deep" ? "Crawling the web..." : "Analyzing..."}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {tool === "deep"
                      ? "Scanning surface web, Reddit, paste sites, and dark web"
                      : "Running ML detection on your content"}
                  </p>
                </div>
                <div className="w-full max-w-xs">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-cyan to-green"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Result */}
        {step === "result" && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="space-y-4">
              <ResultCard result={result} />
              <div className="flex justify-center">
                <Button variant="glass" onClick={goBack}>
                  <ArrowRight className="h-4 w-4" />
                  New Scan
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultCard({ result }: { result: { type: Tool; data: any } }) {
  const conf = typeof result.data?.confidence === "number" ? result.data.confidence : null;
  const label = conf !== null ? confidenceLabel(conf) : null;
  const color = conf !== null ? confidenceColor(conf) : "#00ff88";

  // Handle deep scan response (async job started)
  if (result.type === "deep" && result.data?.status === "started") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Card className="overflow-hidden border-cyan/20 bg-cyan/[0.03]">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-cyan animate-spin" />
              <p className="font-display text-sm font-semibold text-ink">
                DEEP SCAN IN PROGRESS
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                Your deep scan has been queued and is currently running in the background.
                This typically takes 2-5 minutes depending on how many sources need to be checked.
              </p>
              <div className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-xs text-ink-faint">
                  <span className="font-medium text-ink-muted">Scan ID:</span> {result.data.scanId}
                </p>
                <p className="text-xs text-ink-faint mt-1">
                  <span className="font-medium text-ink-muted">Status:</span> Running — scanning surface web, Reddit, paste sites, dark web, and social media
                </p>
              </div>
              <p className="text-xs text-ink-faint">
                You will receive an alert when the scan completes. Check your Alerts tab for results.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            {conf !== null && conf >= 80 ? (
              <AlertTriangle className="h-5 w-5 text-red" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green" />
            )}
            <p className="font-display text-sm font-semibold text-ink">
              {result.type.toUpperCase()} RESULT
            </p>
          </div>

          {conf !== null ? (
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 font-display text-lg font-bold"
                style={{ borderColor: color, color }}
              >
                {Math.round(conf)}%
              </motion.div>
              <div>
                <Badge variant={conf >= 80 ? "red" : conf >= 50 ? "amber" : "green"}>
                  {label}
                </Badge>
                <p className="mt-1 text-sm text-ink-muted">
                  {conf >= 80
                    ? "High confidence of manipulation detected."
                    : conf >= 50
                    ? "Some signs of manipulation detected."
                    : "Looks authentic."}
                </p>
              </div>
            </div>
          ) : result.data?.error ? (
            <div className="rounded-lg bg-red/5 border border-red/10 p-3">
              <p className="text-sm text-red">{result.data.error}</p>
            </div>
          ) : result.data?.alerts ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">
                Scan completed. Found <span className="font-semibold text-ink">{result.data.count || 0}</span> potential matches.
              </p>
              {result.data.alerts.length > 0 && (
                <div className="space-y-2">
                  {result.data.alerts.slice(0, 5).map((alert: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2">
                      <AlertTriangle className="h-4 w-4 text-amber shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ink truncate">{alert.sourceUrl || alert.matchedOn || 'Match found'}</p>
                        <p className="text-[10px] text-ink-faint">{alert.matchedOn} — {alert.confidence}% confidence</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-xs text-ink-faint">No results to display</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
