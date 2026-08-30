import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NpsSurvey() {
  const { toast } = useApp();
  const [show, setShow] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.getNpsStatus().then((res: any) => {
      if (res?.eligibleForSurvey) {
        // Show after 5 seconds of usage
        const timer = setTimeout(() => setShow(true), 5000);
        return () => clearTimeout(timer);
      }
    }).catch(() => {});
  }, []);

  async function submit() {
    if (score === null) return;
    setSubmitting(true);
    try {
      await api.submitNps(score, comment.trim() || undefined);
      setSubmitted(true);
      toast({ title: "Thanks for rating!", variant: "success" });
      setTimeout(() => setShow(false), 2000);
    } catch (e: any) {
      toast({ title: "Failed to submit", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!show || submitted) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>How are we doing?</CardTitle>
              <CardDescription>Rate your experience with Enclave</CardDescription>
            </div>
            <button onClick={() => setShow(false)} className="rounded-lg p-1 text-ink-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score selector */}
          <div className="flex justify-center gap-1.5">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setScore(i)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all",
                  score === i
                    ? i <= 6 ? "bg-red/20 text-red" : i <= 8 ? "bg-amber/20 text-amber" : "bg-green/20 text-green"
                    : "bg-white/[0.04] text-ink-muted hover:text-ink"
                )}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-ink-faint">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>

          {/* Comment */}
          {score !== null && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any thoughts? (optional)"
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-cyan/40 focus:outline-none"
            />
          )}

          <Button className="w-full" onClick={submit} disabled={score === null || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {score === null ? "Select a score" : "Submit"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
