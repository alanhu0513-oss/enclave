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
  ChevronRight,
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
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
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
        data = await api.embedWatermark(file, "© ENCLADE");
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
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
          <ScanSearch className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Deep Scan</h2>
          <p className="text-sm text-ink-muted">
            Detect deepfakes & unauthorized use of your identity
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i <= stepIdx ? "bg-cyan/20 text-cyan" : "bg-white/[0.04] text-ink-faint"
              )}
            >
              {i < stepIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn("text-xs", i <= stepIdx ? "text-ink" : "text-ink-faint")}>{label}</span>
            {i < STEP_LABELS.length - 1 && <ChevronRight className="h-3 w-3 text-ink-faint" />}
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
                return (
                  <StaggerItem key={t.id}>
                    <Card
                      className="cursor-pointer transition-all hover:border-cyan/40 hover:bg-cyan/[0.03]"
                      onClick={() => chooseTool(t.id)}
                    >
                      <CardContent className="p-5">
                        <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl", COLOR_MAP[t.color])}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-ink">{t.label}</p>
                        <p className="mt-1 text-xs text-ink-muted">{t.desc}</p>
                      </CardContent>
                    </Card>
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
                    <Button onClick={runScan} className="shrink-0">
                      <Crosshair className="h-4 w-4" />
                      Scan
                    </Button>
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

  return (
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
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 font-display text-lg font-bold"
              style={{ borderColor: color, color }}
            >
              {Math.round(conf)}%
            </div>
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
        ) : (
          <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-ink-muted">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
