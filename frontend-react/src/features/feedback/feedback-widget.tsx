import { useState } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "idea" | "general";

const TYPE_OPTIONS: { id: FeedbackType; label: string }[] = [
  { id: "bug", label: "Bug Report" },
  { id: "idea", label: "Feature Idea" },
  { id: "general", label: "General" },
];

export function FeedbackWidget() {
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!message.trim()) {
      toast({ title: "Please enter a message", variant: "info" });
      return;
    }
    setSubmitting(true);
    try {
      await api.submitFeedback({ type, message: message.trim(), page: window.location.pathname });
      toast({ title: "Thanks for your feedback!", variant: "success" });
      setMessage("");
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Failed to submit", body: e.message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-cyan text-black shadow-lg transition-transform hover:scale-110"
        title="Send feedback"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Send Feedback</CardTitle>
                  <CardDescription>Report bugs, suggest features, or share thoughts</CardDescription>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-ink-muted hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setType(opt.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      type === opt.id ? "bg-cyan/20 text-cyan" : "bg-white/[0.04] text-ink-muted hover:text-ink"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-cyan/40 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="glass" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
