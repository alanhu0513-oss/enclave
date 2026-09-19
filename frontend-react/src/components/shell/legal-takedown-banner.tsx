import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Scale, ArrowRight, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActiveTakedownEvent {
  id: string;
  platform?: string;
  targetUrl?: string;
  status?: string;
  timestamp?: string | number;
}

export function LegalTakedownBanner() {
  const [activeTakedown, setActiveTakedown] = useState<ActiveTakedownEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check initial state from localStorage
    try {
      const stored = localStorage.getItem("enclave_active_takedown");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only show if not explicitly dismissed for this ID in session
        const dismissedId = sessionStorage.getItem("enclave_takedown_banner_dismissed");
        if (dismissedId !== parsed.id) {
          setActiveTakedown(parsed);
          setDismissed(false);
        }
      }
    } catch {
      // ignore
    }

    // Listen for real-time takedown initiation events
    const handleInitiated = (e: Event) => {
      const customEvent = e as CustomEvent<ActiveTakedownEvent>;
      if (customEvent.detail) {
        setActiveTakedown(customEvent.detail);
        setDismissed(false);
        sessionStorage.removeItem("enclave_takedown_banner_dismissed");
      }
    };

    window.addEventListener("enclave:takedown_initiated", handleInitiated);
    return () => {
      window.removeEventListener("enclave:takedown_initiated", handleInitiated);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (activeTakedown?.id) {
      sessionStorage.setItem("enclave_takedown_banner_dismissed", activeTakedown.id);
    }
  };

  const handleRedirect = () => {
    const id = activeTakedown?.id || "enc-dmca-active";
    window.history.pushState({}, "", `/takedown/${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (!activeTakedown || dismissed) {
    return null;
  }

  const platform = activeTakedown.platform || "Target Host / CDN";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0, y: -10 }}
        animate={{ height: "auto", opacity: 1, y: 0 }}
        exit={{ height: 0, opacity: 0, y: -10 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-30 overflow-hidden border-b border-cyan/30 bg-gradient-to-r from-[#0a0f1d] via-[#091522] to-[#0a0f1d] px-4 py-3 shadow-[0_4px_24px_rgba(0,242,254,0.12)]"
      >
        {/* Animated glowing border top line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan to-transparent animate-pulse" />

        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-ink">
          {/* Icon & Message */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan/40 bg-cyan/15 text-cyan shadow-[0_0_12px_rgba(0,242,254,0.3)]">
              <Scale className="h-4.5 w-4.5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan" />
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-cyan">
                  DMCA Enforcement Active
                </span>
                <span className="font-display text-xs sm:text-sm font-semibold text-ink">
                  Legal Takedown Process Initiated
                </span>
              </div>
              <p className="font-mono text-[11px] text-ink-muted leading-tight">
                Statutory notice served to <span className="text-cyan font-bold">{platform}</span>. Evidence hash sealed under 17 U.S.C. § 512.
              </p>
            </div>
          </div>

          {/* Action and Dismiss */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              onClick={handleRedirect}
              className="gap-1.5 bg-cyan hover:bg-cyan/90 text-black font-mono text-xs font-bold shadow-[0_0_12px_rgba(0,242,254,0.25)] h-8 px-3"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>View Detailed Status Page</span>
              <ArrowRight className="h-3 w-3 ml-0.5" />
            </Button>

            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg p-1 text-ink-faint hover:bg-white/[0.06] hover:text-ink transition-colors"
              title="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
