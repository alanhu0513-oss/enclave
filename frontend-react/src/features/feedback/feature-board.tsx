import { useEffect, useState } from "react";
import { Lightbulb, Plus, Loader2, ThumbsUp, X } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-cyan/15 text-cyan",
  planned: "bg-purple/15 text-purple",
  in_progress: "bg-amber/15 text-amber",
  done: "bg-green/15 text-green",
};

export function FeatureBoard() {
  const { toast } = useApp();
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.getFeatureRequests();
      setFeatures(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await api.createFeatureRequest(title.trim(), desc.trim() || undefined);
      toast({ title: "Feature request created", variant: "success" });
      setTitle("");
      setDesc("");
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(id: string) {
    setVoting(id);
    try {
      await api.voteFeatureRequest(id);
      await load();
    } catch (e: any) {
      toast({ title: "Failed to vote", variant: "error" });
    } finally {
      setVoting(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber" />
              <CardTitle>Feature Requests</CardTitle>
            </div>
            <CardDescription>Vote on ideas and suggest new features</CardDescription>
          </div>
          <Button variant="glass" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "New"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="space-y-2 rounded-xl bg-white/[0.03] p-3">
            <Input
              placeholder="Feature title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-cyan/40 focus:outline-none"
            />
            <Button size="sm" onClick={create} disabled={submitting || !title.trim()}>
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Submit
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-ink-faint" />
          </div>
        ) : features.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">No feature requests yet. Be the first!</p>
        ) : (
          <StaggerContainer className="space-y-2">
            {features.map((f) => (
              <StaggerItem key={f.id}>
                <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
                  <button
                    onClick={() => vote(f.id)}
                    disabled={voting === f.id}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors",
                      f.votes > 0 ? "bg-cyan/10 text-cyan" : "bg-white/[0.04] text-ink-muted hover:text-ink"
                    )}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold">{f.votes}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{f.title}</p>
                    {f.description && (
                      <p className="mt-0.5 text-xs text-ink-muted">{f.description}</p>
                    )}
                  </div>
                  {f.status !== "open" && (
                    <Badge className={cn("shrink-0 text-[10px]", STATUS_COLORS[f.status] || STATUS_COLORS.open)}>
                      {f.status}
                    </Badge>
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </CardContent>
    </Card>
  );
}
