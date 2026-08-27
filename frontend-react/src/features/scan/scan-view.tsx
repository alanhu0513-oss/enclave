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
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { confidenceColor, confidenceLabel } from "@/lib/utils";

type Tool = "url" | "image" | "deep" | "reverse" | "watermark";

export function ScanView() {
  const { toast } = useApp();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ type: Tool; data: any } | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const wmRef = useRef<HTMLInputElement>(null);
  const revRef = useRef<HTMLInputElement>(null);

  async function scanUrl() {
    if (!url) {
      toast({ title: "Enter a URL", variant: "info" });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const data = await api.scanUrl(url);
      setResult({ type: "url", data });
      toast({ title: "Scan complete", variant: "success" });
    } catch (e: any) {
      toast({ title: "Scan failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function scanImage(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const data = await api.scanImage(file);
      setResult({ type: "image", data });
      toast({ title: "Image scan complete", variant: "success" });
    } catch (e: any) {
      toast({ title: "Scan failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function deepScan() {
    setBusy(true);
    setResult(null);
    toast({ title: "Deep scan started", body: "This may take a few minutes", variant: "info" });
    try {
      const data = await api.deepScan();
      setResult({ type: "deep", data });
      toast({ title: "Deep scan complete", variant: "success" });
    } catch (e: any) {
      toast({ title: "Deep scan failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function reverseSearch(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const data = await api.reverseImageSearch(file);
      setResult({ type: "reverse", data });
      toast({ title: "Reverse search complete", variant: "success" });
    } catch (e: any) {
      toast({ title: "Search failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function watermark(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const data = await api.embedWatermark(file, "© ENCLAVE");
      setResult({ type: "watermark", data });
      toast({ title: "Watermark embedded", variant: "success" });
    } catch (e: any) {
      toast({ title: "Embed failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
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

      {/* Primary scan tools */}
      <StaggerContainer className="grid gap-5 lg:grid-cols-2">
        {/* URL scan */}
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                <Globe className="h-5 w-5" />
              </div>
              <CardTitle>Scan a URL</CardTitle>
              <CardDescription>
                Paste a link and we'll analyze it for deepfakes and impersonation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && scanUrl()}
                  disabled={busy}
                />
                <Button onClick={scanUrl} disabled={busy} className="shrink-0">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                  Scan
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Image scan */}
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-green/15 text-green">
                <ImagePlus className="h-5 w-5" />
              </div>
              <CardTitle>Scan an Image</CardTitle>
              <CardDescription>
                Upload a photo or screenshot to check if it's a deepfake.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) scanImage(f);
                }}
              />
              <Button variant="glass" className="w-full" disabled={busy} onClick={() => imageRef.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Upload Image
              </Button>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Deep scan */}
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-purple/15 text-purple">
                <ScanSearch className="h-5 w-5" />
              </div>
              <CardTitle>Deep Web Crawl</CardTitle>
              <CardDescription>
                Actively search the web & dark web for your face and data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="glass" className="w-full" disabled={busy} onClick={deepScan}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Start Deep Scan
              </Button>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Watermark */}
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber/15 text-amber">
                <Stamp className="h-5 w-5" />
              </div>
              <CardTitle>Rights Shield</CardTitle>
              <CardDescription>
                Embed an invisible watermark to prove ownership & deter theft.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <input
                  ref={wmRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) watermark(f);
                  }}
                />
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => wmRef.current?.click()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
                  Embed Watermark
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Reverse image */}
        <StaggerItem className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/15 text-green">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">Reverse Image Search</p>
                  <p className="text-xs text-ink-muted">
                    Upload an image to find where it appears across the web
                  </p>
                </div>
              </div>
              <input
                ref={revRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) reverseSearch(f);
                }}
              />
              <Button variant="glass" disabled={busy} onClick={() => revRef.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                Search Image
              </Button>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Result panel */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <ResultCard result={result} />
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
              <Badge
                variant={conf >= 80 ? "red" : conf >= 50 ? "amber" : "green"}
              >
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
