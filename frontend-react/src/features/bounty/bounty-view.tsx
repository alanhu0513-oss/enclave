import { useEffect, useState, useRef } from "react";
import {
  DollarSign,
  Camera,
  Search,
  Trophy,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Target,
  Eye,
  ArrowUpRight,
  Users,
  Crosshair,
  Coins,
  TrendingUp,
  Globe,
  Image,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  SectionHeader,
  StatCard,
  EmptyState,
  LoadingSpinner,
} from "@/components/ui/dashboard";
import {
  StaggerContainer,
  StaggerItem,
  Kinetic,
  FadeIn,
} from "@/components/ui/motion";
import { cn } from "@/lib/utils";

type BountyTab = "victim" | "hunter";

interface BountyProfile {
  id: string;
  userId: string;
  faceImages: string[];
  bountyAmount: number;
  status: string;
  totalPaid: number;
  totalMatches: number;
  enrolledAt: string;
}

interface BountyMatch {
  scanId: string;
  imageUrl: string;
  source: string;
  sourceUrl: string;
  confidence: number;
  bountyAmount: number;
  status: string;
  createdAt: string;
}

interface LeaderboardEntry {
  hunterId: string;
  scans: number;
  matches: number;
  confirmed: number;
  earnings: number;
}

interface BountyStats {
  activeProfiles: number;
  totalScans: number;
  totalMatches: number;
  confirmedMatches: number;
  totalPayouts: number;
}

interface ScanResult {
  id: string;
  hunterId: string;
  imageUrl: string;
  source: string;
  sourceUrl: string;
  matches: number;
  candidates: number;
  status: string;
  createdAt: string;
}

const MATCH_STATUS_COLORS: Record<string, "green" | "amber" | "red" | "cyan"> = {
  pending: "amber",
  confirmed: "green",
  rejected: "red",
  paid: "green",
};

export function BountyView() {
  const { toast } = useApp();
  const [tab, setTab] = useState<BountyTab>("victim");

  // Victim state
  const [profile, setProfile] = useState<BountyProfile | null>(null);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [matches, setMatches] = useState<BountyMatch[]>([]);

  // Hunter state
  const [stats, setStats] = useState<BountyStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Enrollment form
  const [faceFiles, setFaceFiles] = useState<File[]>([]);
  const [facePreviews, setFacePreviews] = useState<string[]>([]);
  const [bountyAmount, setBountyAmount] = useState(25);
  const [enrolling, setEnrolling] = useState(false);
  const faceInputRef = useRef<HTMLInputElement>(null);

  // Scan form
  const [scanUrl, setScanUrl] = useState("");
  const [scanImage, setScanImage] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Confirm action
  const [confirming, setConfirming] = useState<string | null>(null);

  const loading = enrolled === null;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [profileRes, matchesRes, statsRes, leaderboardRes] =
        await Promise.allSettled([
          api.getBountyProfile(),
          api.getBountyMatches(),
          api.getBountyStats(),
          api.getBountyLeaderboard(),
        ]);

      if (profileRes.status === "fulfilled") {
        const p = (profileRes.value as any)?.profile;
        if (p && p.enrolled !== false && p.id) {
          setProfile(p);
          setEnrolled(true);
        } else {
          setEnrolled(false);
        }
      } else {
        setEnrolled(false);
      }

      if (matchesRes.status === "fulfilled") {
        setMatches((matchesRes.value as any)?.matches || []);
      }

      if (statsRes.status === "fulfilled") {
        setStats((statsRes.value as any) || null);
      }

      if (leaderboardRes.status === "fulfilled") {
        setLeaderboard((leaderboardRes.value as any)?.leaderboard || []);
      }
    } catch {
      setEnrolled(false);
    }
  }

  function handleFaceSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const next = [...faceFiles, ...files].slice(0, 6);
    setFaceFiles(next);
    const previews = next.map((f) => URL.createObjectURL(f));
    setFacePreviews(previews);
  }

  function removeFace(idx: number) {
    const next = faceFiles.filter((_, i) => i !== idx);
    setFaceFiles(next);
    URL.revokeObjectURL(facePreviews[idx]);
    setFacePreviews((p) => p.filter((_, i) => i !== idx));
  }

  async function handleEnroll() {
    if (faceFiles.length < 3) {
      toast({ title: "Upload at least 3 face images", variant: "error" });
      return;
    }
    setEnrolling(true);
    try {
      // Convert files to data URLs for the API
      const faceImages = await Promise.all(
        faceFiles.map(
          (f) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(f);
            }),
        ),
      );
      await api.enrollBounty({ faceImages, bountyAmount });
      setEnrolled(true);
      toast({ title: "Bounty enrolled successfully!", variant: "success" });
      await load();
    } catch (e: any) {
      toast({
        title: "Enrollment failed",
        body: e.message,
        variant: "error",
      });
    } finally {
      setEnrolling(false);
    }
  }

  async function handleScan() {
    if (!scanUrl && !scanImage) {
      toast({
        title: "Enter a URL or upload an image",
        variant: "error",
      });
      return;
    }
    setScanning(true);
    setScanResult(null);
    try {
      const data: any = {};
      if (scanUrl) {
        data.imageUrl = scanUrl;
        data.source = "url";
        data.sourceUrl = scanUrl;
      } else if (scanImage) {
        // Upload image first as data URL
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(scanImage);
        });
        data.imageUrl = dataUrl;
        data.source = "upload";
      }
      const res = (await api.scanBounty(data)) as any;
      setScanResult(res?.scan || null);
      if (res?.matchCount > 0) {
        toast({
          title: `${res.matchCount} match(es) found!`,
          variant: "success",
        });
      } else {
        toast({ title: "No matches found", variant: "info" });
      }
    } catch (e: any) {
      toast({
        title: "Scan failed",
        body: e.message,
        variant: "error",
      });
    } finally {
      setScanning(false);
    }
  }

  async function handleConfirm(scanId: string, confirmed: boolean) {
    setConfirming(scanId);
    try {
      await api.confirmBountyMatch(scanId, confirmed);
      toast({
        title: confirmed ? "Match confirmed" : "Match rejected",
        variant: "success",
      });
      await load();
    } catch (e: any) {
      toast({
        title: "Action failed",
        body: e.message,
        variant: "error",
      });
    } finally {
      setConfirming(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FadeIn>
        <SectionHeader
          icon={DollarSign}
          title="Deepfake Bounty"
          description="Community-powered identity protection"
          action={
            <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(["victim", "hunter"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200",
                    tab === t
                      ? "bg-cyan/20 text-cyan"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {t === "victim" ? "My Bounty" : "Hunter Mode"}
                </button>
              ))}
            </div>
          }
        />
      </FadeIn>

      {tab === "victim" ? (
        <VictimMode
          profile={profile}
          enrolled={enrolled}
          matches={matches}
          faceFiles={faceFiles}
          facePreviews={facePreviews}
          bountyAmount={bountyAmount}
          enrolling={enrolling}
          confirming={confirming}
          onFaceSelect={handleFaceSelect}
          onRemoveFace={removeFace}
          onAmountChange={setBountyAmount}
          onEnroll={handleEnroll}
          onConfirm={handleConfirm}
          faceInputRef={faceInputRef}
        />
      ) : (
        <HunterMode
          stats={stats}
          leaderboard={leaderboard}
          scanUrl={scanUrl}
          scanImage={scanImage}
          scanning={scanning}
          scanResult={scanResult}
          matches={matches}
          onUrlChange={setScanUrl}
          onImageChange={setScanImage}
          onScan={handleScan}
          scanInputRef={scanInputRef}
        />
      )}
    </div>
  );
}

/* ── Victim Mode ───────────────────────────────────────── */
function VictimMode({
  profile,
  enrolled,
  matches,
  faceFiles,
  facePreviews,
  bountyAmount,
  enrolling,
  confirming,
  onFaceSelect,
  onRemoveFace,
  onAmountChange,
  onEnroll,
  onConfirm,
  faceInputRef,
}: {
  profile: BountyProfile | null;
  enrolled: boolean | null;
  matches: BountyMatch[];
  faceFiles: File[];
  facePreviews: string[];
  bountyAmount: number;
  enrolling: boolean;
  confirming: string | null;
  onFaceSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFace: (idx: number) => void;
  onAmountChange: (v: number) => void;
  onEnroll: () => void;
  onConfirm: (scanId: string, confirmed: boolean) => void;
  faceInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-6">
      {!enrolled ? (
        <FadeIn delay={0.1}>
          <Card className="border-cyan/20 bg-cyan/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan" />
                Enroll Your Face
              </CardTitle>
              <CardDescription>
                Upload face images so hunters can identify deepfakes of you.
                Upload at least 3 images from different angles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Face Upload Grid */}
              <div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {facePreviews.map((src, i) => (
                    <div key={i} className="group relative">
                      <img
                        src={src}
                        alt={`Face ${i + 1}`}
                        className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/10"
                      />
                      <button
                        onClick={() => onRemoveFace(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {faceFiles.length < 6 && (
                    <button
                      onClick={() => faceInputRef.current?.click()}
                      className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 text-ink-faint transition-colors hover:border-cyan/40 hover:text-cyan"
                    >
                      <Camera className="mb-1 h-5 w-5" />
                      <span className="text-[10px]">Add</span>
                    </button>
                  )}
                </div>
                <input
                  ref={faceInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onFaceSelect}
                />
                <p className="mt-2 text-xs text-ink-muted">
                  {faceFiles.length}/6 images · {faceFiles.length < 3 ? `Need ${3 - faceFiles.length} more` : "Ready to enroll"}
                </p>
              </div>

              {/* Bounty Amount Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ink">
                    Bounty Amount
                  </label>
                  <span className="text-2xl font-bold text-green">
                    ${bountyAmount}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={bountyAmount}
                  onChange={(e) => onAmountChange(Number(e.target.value))}
                  className="w-full accent-green"
                />
                <div className="flex justify-between text-xs text-ink-muted mt-1">
                  <span>$1</span>
                  <span>$100</span>
                </div>
              </div>

              <Button
                variant="cyan"
                className="w-full"
                disabled={faceFiles.length < 3 || enrolling}
                onClick={onEnroll}
              >
                {enrolling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="mr-2 h-4 w-4" />
                )}
                {enrolling
                  ? "Enrolling..."
                  : `Enroll with $${bountyAmount} Bounty`}
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      ) : (
        <>
          {/* Profile Status */}
          <FadeIn delay={0.1}>
            <Card>
              <CardContent className="flex items-center gap-6 pt-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green/15 text-green">
                  <DollarSign className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-ink">
                      Your Bounty
                    </h3>
                    <Badge variant={profile?.status === "active" ? "green" : "amber"}>
                      {profile?.status || "active"}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink-muted">
                    Enrolled {profile?.enrolledAt ? new Date(profile.enrolledAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-green">
                    ${profile?.bountyAmount || 0}
                  </p>
                  <p className="text-xs text-ink-muted">per match</p>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Quick Stats */}
          <StaggerContainer className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Crosshair}
              label="Total Matches"
              value={profile?.totalMatches || 0}
              color="cyan"
            />
            <StatCard
              icon={Coins}
              label="Total Paid"
              value={profile?.totalPaid || 0}
              color="green"
              suffix="$"
            />
            <StatCard
              icon={Image}
              label="Face Images"
              value={profile?.faceImages?.length || 0}
              color="purple"
            />
          </StaggerContainer>

          {/* Matches */}
          <FadeIn delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-cyan" />
                  Detected Matches
                </CardTitle>
                <CardDescription>
                  {matches.length} match{matches.length !== 1 ? "es" : ""} found across the web
                </CardDescription>
              </CardHeader>
              <CardContent>
                {matches.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No matches detected"
                    description="No deepfakes of your face have been found yet. We'll keep monitoring."
                  />
                ) : (
                  <StaggerContainer className="space-y-3">
                    {matches.map((m) => (
                      <StaggerItem key={m.scanId}>
                        <Kinetic>
                          <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red/15 text-red">
                              <Eye className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-ink">
                                  {m.source || "Unknown Source"}
                                </p>
                                <Badge variant={MATCH_STATUS_COLORS[m.status] || "default"}>
                                  {m.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-ink-muted">
                                {Math.round(m.confidence * 100)}% confidence ·{" "}
                                ${m.bountyAmount} bounty
                                {m.sourceUrl && (
                                  <>
                                    {" · "}
                                    <a
                                      href={m.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan hover:underline"
                                    >
                                      View Source
                                    </a>
                                  </>
                                )}
                              </p>
                              <p className="text-xs text-ink-faint">
                                {new Date(m.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {m.status === "pending" && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    disabled={confirming === m.scanId}
                                    onClick={() => onConfirm(m.scanId, true)}
                                  >
                                    {confirming === m.scanId ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    disabled={confirming === m.scanId}
                                    onClick={() => onConfirm(m.scanId, false)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </Kinetic>
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        </>
      )}
    </div>
  );
}

/* ── Hunter Mode ───────────────────────────────────────── */
function HunterMode({
  stats,
  leaderboard,
  scanUrl,
  scanImage,
  scanning,
  scanResult,
  matches,
  onUrlChange,
  onImageChange,
  onScan,
  scanInputRef,
}: {
  stats: BountyStats | null;
  leaderboard: LeaderboardEntry[];
  scanUrl: string;
  scanImage: File | null;
  scanning: boolean;
  scanResult: ScanResult | null;
  matches: BountyMatch[];
  onUrlChange: (v: string) => void;
  onImageChange: (f: File | null) => void;
  onScan: () => void;
  scanInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-6">
      {/* Stats Strip */}
      {stats && (
        <StaggerContainer className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Users}
            label="Active Bounties"
            value={stats.activeProfiles}
            color="cyan"
          />
          <StatCard
            icon={Search}
            label="Total Scans"
            value={stats.totalScans}
            color="purple"
          />
          <StatCard
            icon={Coins}
            label="Total Payouts"
            value={stats.totalPayouts}
            color="green"
            suffix="$"
          />
        </StaggerContainer>
      )}

      {/* Scan Section */}
      <FadeIn delay={0.1}>
        <Card className="border-cyan/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-cyan" />
              Scan for Deepfakes
            </CardTitle>
            <CardDescription>
              Enter an image URL or upload an image to check against enrolled bounties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  placeholder="Paste image URL..."
                  value={scanUrl}
                  onChange={(e) => onUrlChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImageChange(f);
                  }}
                />
                <Button
                  variant="glass"
                  onClick={() => scanInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
              <Button
                variant="cyan"
                disabled={(!scanUrl && !scanImage) || scanning}
                onClick={onScan}
              >
                {scanning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Scan
              </Button>
            </div>
            {scanImage && (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Image className="h-4 w-4" />
                {scanImage.name}
                <button
                  onClick={() => onImageChange(null)}
                  className="text-ink-faint hover:text-red"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Scan Result */}
      {scanResult && (
        <FadeIn delay={0.05}>
          <Card className="border-green/20 bg-green/[0.02]">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green/15 text-green">
                <Target className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">
                  {scanResult.matches > 0
                    ? `${scanResult.matches} match(es) found!`
                    : "No matches found"}
                </p>
                <p className="text-xs text-ink-muted">
                  {scanResult.candidates} candidate(s) checked ·{" "}
                  {scanResult.source || "scan"} ·{" "}
                  {new Date(scanResult.createdAt).toLocaleTimeString()}
                </p>
              </div>
              {scanResult.matches > 0 && (
                <Badge variant="green">
                  <Coins className="h-3 w-3 mr-1" />
                  Bounty Available
                </Badge>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Leaderboard */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber" />
              Hunter Leaderboard
            </CardTitle>
            <CardDescription>
              Top bounty hunters ranked by confirmed matches
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No hunters yet"
                description="Be the first to scan and earn bounty rewards."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-ink-muted">
                      <th className="pb-3 pr-4 font-medium">#</th>
                      <th className="pb-3 pr-4 font-medium">Hunter</th>
                      <th className="pb-3 pr-4 font-medium text-right">Scans</th>
                      <th className="pb-3 pr-4 font-medium text-right">Matches</th>
                      <th className="pb-3 pr-4 font-medium text-right">Confirmed</th>
                      <th className="pb-3 font-medium text-right">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, i) => (
                      <tr
                        key={entry.hunterId}
                        className="border-b border-white/[0.04] last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                              i === 0
                                ? "bg-amber/20 text-amber"
                                : i === 1
                                  ? "bg-white/10 text-ink-muted"
                                  : i === 2
                                    ? "bg-orange-500/15 text-orange-400"
                                    : "text-ink-faint",
                            )}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                          {entry.hunterId.slice(0, 12)}...
                        </td>
                        <td className="py-3 pr-4 text-right text-ink-muted">
                          {entry.scans}
                        </td>
                        <td className="py-3 pr-4 text-right text-cyan">
                          {entry.matches}
                        </td>
                        <td className="py-3 pr-4 text-right text-green">
                          {entry.confirmed}
                        </td>
                        <td className="py-3 text-right font-medium text-green">
                          ${entry.earnings.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Recent Matches (for hunter to confirm) */}
      {matches.length > 0 && (
        <FadeIn delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-cyan" />
                Your Recent Scans
              </CardTitle>
              <CardDescription>Matches awaiting confirmation from bounty owners</CardDescription>
            </CardHeader>
            <CardContent>
              <StaggerContainer className="space-y-3">
                {matches.slice(0, 10).map((m) => (
                  <StaggerItem key={m.scanId}>
                    <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                        <Crosshair className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink">
                            {m.source || "Scan"}
                          </p>
                          <Badge variant={MATCH_STATUS_COLORS[m.status] || "default"}>
                            {m.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted">
                          {Math.round(m.confidence * 100)}% · ${m.bountyAmount}
                          {m.sourceUrl && (
                            <>
                              {" · "}
                              <a
                                href={m.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan hover:underline inline-flex items-center gap-0.5"
                              >
                                Source <ArrowUpRight className="h-3 w-3" />
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-ink-faint">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
