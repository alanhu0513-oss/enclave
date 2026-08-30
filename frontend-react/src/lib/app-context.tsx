import * as React from "react";
import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type TabId =
  | "home"
  | "shield"
  | "scan"
  | "alerts"
  | "insights"
  | "monitoring"
  | "reports"
  | "enterprise"
  | "admin"
  | "family"
  | "shield-dashboard"
  | "insurance"
  | "passport"
  | "bounty"
  | "settings";

interface Toast {
  id: number;
  title: string;
  body?: string;
  variant: "success" | "error" | "info";
}

interface AppState {
  tab: TabId;
  setTab: (t: TabId) => void;
  unread: number;
  setUnread: (n: number) => void;
  toast: (opts: {
    title: string;
    body?: string;
    variant?: "success" | "error" | "info";
  }) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<TabId>("home");
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback(
    (opts: {
      title: string;
      body?: string;
      variant?: "success" | "error" | "info";
    }) => {
      const id = ++idRef.current;
      setToasts((t) => [
        ...t,
        { id, title: opts.title, body: opts.body, variant: opts.variant || "info" },
      ]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 4200);
    },
    []
  );

  return (
    <AppContext.Provider value={{ tab, setTab, unread, setUnread, toast }}>
      {children}
      <ToastStack toasts={toasts} setToasts={setToasts} />
    </AppContext.Provider>
  );
}

function ToastStack({
  toasts,
  setToasts,
}: {
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(360px,90vw)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto glass-strong flex items-start gap-3 rounded-xl p-3.5 shadow-xl"
          >
            {t.variant === "success" && (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green" />
            )}
            {t.variant === "error" && (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red" />
            )}
            {t.variant === "info" && (
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.body && (
                <p className="mt-0.5 text-xs text-ink-muted">{t.body}</p>
              )}
            </div>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              className="text-ink-faint transition-colors hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
