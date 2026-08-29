import { useEffect, useState } from "react";
import {
  Globe2,
  Users2,
  Share2,
  ThumbsUp,
  ThumbsDown,
  ShieldAlert,
  Loader2,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";

const IOC_TYPES: Record<string, { label: string; severity: string }> = {
  url: { label: "Malicious URL", severity: "high" },
  domain: { label: "Suspicious Domain", severity: "medium" },
  image_hash: { label: "Deepfake Hash", severity: "critical" },
  face_hash: { label: "Stolen Face", severity: "critical" },
  email: { label: "Abuse Email", severity: "info" },
  keyword: { label: "Nudifier Keyword", severity: "high" },
  platform: { label: "Abusive Platform", severity: "high" },
};

const SEV_COLOR: Record<string, string> = {
  critical: "red",
  high: "amber",
  medium: "cyan",
  info: "muted",
};

const FORUM_CATEGORIES = ["general", "help", "success", "discussion"];

export function CommunityView() {
  const { toast } = useApp();
  const [threats, setThreats] = useState<any[]>([]);
  const [threatStats, setThreatStats] = useState<any>(null);
  const [forumStats, setForumStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [forumCat, setForumCat] = useState("general");
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [tv, ts, fs] = await Promise.all([
        api.getThreatShares({ limit: 50 }),
        api.getThreatStats().catch(() => null),
        api.getCommunityStats().catch(() => null),
      ]);
      const list = Array.isArray(tv) ? tv : (tv as any)?.indicators || [];
      setThreats(list);
      setThreatStats(ts || null);
      setForumStats(fs || null);
    } catch (e: any) {
      toast({ title: "Failed to load community", body: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    setPostsLoading(true);
    try {
      const res: any = await api.getForumPosts({ limit: 50, category: forumCat });
      const list = Array.isArray(res) ? res : res?.posts || [];
      setPosts(list);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadPosts();
  }, [forumCat]);

  async function vote(id: string, vote: string) {
    try {
      await api.voteThreat(id, vote);
      setThreats((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, community_votes: (t.community_votes || 0) + 1 }
            : t
        )
      );
      toast({ title: vote === "confirm" ? "Confirmed" : "Disputed", variant: "success" });
    } catch (e: any) {
      toast({ title: "Vote failed", body: e.message, variant: "error" });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple/15 text-purple">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Threat Intelligence</h2>
            <p className="text-sm text-ink-muted">Community-shared indicators & discussion</p>
          </div>
        </div>
        <Button variant="cyan" onClick={() => setShareOpen(true)}>
          <Share2 className="h-4 w-4" /> Share an IoC
        </Button>
      </div>

      {/* Stats */}
      <StaggerContainer className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatsCard label="Threats shared" value={threatStats?.totalIndicators ?? "—"} icon="threat" />
        </StaggerItem>
        <StaggerItem>
          <StatsCard label="Community votes" value={threatStats?.totalVotes ?? "—"} icon="vote" />
        </StaggerItem>
        <StaggerItem>
          <StatsCard label="Forum posts" value={forumStats?.totalPosts ?? "—"} icon="post" />
        </StaggerItem>
        <StaggerItem>
          <StatsCard label="Forum members" value={forumStats?.totalAuthors ?? "—"} icon="user" />
        </StaggerItem>
      </StaggerContainer>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Threat feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red" /> Threat Feed
            </CardTitle>
            <CardDescription>Latest community-confirmed indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-ink-faint">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : threats.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">No threats shared yet. Be the first!</p>
            ) : (
              threats.map((t) => {
                const meta = IOC_TYPES[t.ioc_type] || { label: t.ioc_type, severity: t.severity || "medium" };
                return (
                  <div key={t.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={(SEV_COLOR[meta.severity] as any) || "muted"}>
                            {String(meta.severity).toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{meta.label}</Badge>
                        </div>
                        <p className="mt-1.5 break-all font-mono text-xs text-ink">{t.ioc_value}</p>
                        {t.description && (
                          <p className="mt-1 text-xs text-ink-muted line-clamp-2">{t.description}</p>
                        )}
                        <p className="mt-1 text-[11px] text-ink-faint">
                          {Math.round((t.confidence || 0) * 100)}% confidence · {t.community_votes || 0} votes
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button variant="glass" size="sm" onClick={() => vote(t.id, "confirm")}>
                        <ThumbsUp className="h-3.5 w-3.5" /> Confirm
                      </Button>
                      <Button variant="glass" size="sm" onClick={() => vote(t.id, "dispute")}>
                        <ThumbsDown className="h-3.5 w-3.5" /> Dispute
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Forum */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan" /> Community Forum
            </CardTitle>
            <CardDescription>Anonymous discussion & support</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {FORUM_CATEGORIES.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={forumCat === c ? "cyan" : "glass"}
                  onClick={() => setForumCat(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {postsLoading ? (
                <div className="flex justify-center py-8 text-ink-faint">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : posts.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">No posts yet in #{forumCat}</p>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-sm font-medium text-ink">{p.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{p.body}</p>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {p.category} · {p.votes || 0} votes · {p.replies?.length || 0} replies
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} onShared={load} />
    </div>
  );
}

function ShareDialog({
  open,
  onClose,
  onShared,
}: {
  open: boolean;
  onClose: () => void;
  onShared: () => void;
}) {
  const { toast } = useApp();
  const [iocType, setIocType] = useState("url");
  const [iocValue, setIocValue] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!iocValue) {
      toast({ title: "Enter an indicator value", variant: "info" });
      return;
    }
    setSaving(true);
    try {
      await api.shareThreat({ iocType, iocValue, description });
      toast({ title: "Indicator shared", variant: "success" });
      onClose();
      onShared();
    } catch (e: any) {
      toast({ title: "Share failed", body: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-green" /> Share an Indicator
          </DialogTitle>
          <DialogDescription>Report a malicious URL, domain, or known deepfake to help the community.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Type</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(IOC_TYPES).map(([key, meta]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={iocType === key ? "cyan" : "glass"}
                  onClick={() => setIocType(key)}
                >
                  {meta.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Value</label>
            <Input
              placeholder={iocType === "url" ? "https://malicious.example.com" : "Enter value…"}
              value={iocValue}
              onChange={(e) => setIocValue(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Description (optional)</label>
            <Input
              placeholder="What should the community look for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button variant="cyan" className="w-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Share Indicator
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatsCard({ label, value, icon }: { label: string; value: any; icon: string }) {
  const Icon = icon === "threat" ? ShieldAlert : icon === "vote" ? ThumbsUp : icon === "post" ? MessageSquare : Users2;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/15 text-purple">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-2xl font-bold text-ink">{value}</p>
          <p className="text-xs text-ink-muted">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
