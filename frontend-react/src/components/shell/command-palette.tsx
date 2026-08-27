import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, CornerDownLeft } from "lucide-react";
import { useApp, type TabId } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { setTab } = useApp();
  const { logout, lock } = useAuth();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const items: CommandItem[] = [
    { id: "home", label: "Go to Home", hint: "tab", action: () => go("home") },
    { id: "shield", label: "Open Shields", hint: "tab", action: () => go("shield") },
    { id: "scan", label: "Run a Scan", hint: "tab", action: () => go("scan") },
    { id: "alerts", label: "View Alerts", hint: "tab", action: () => go("alerts") },
    { id: "insights", label: "Insights & Reports", hint: "tab", action: () => go("insights") },
    { id: "settings", label: "Settings", hint: "tab", action: () => go("settings") },
    { id: "lock", label: "Lock Vault", hint: "action", action: lockAction },
    { id: "logout", label: "Sign Out", hint: "action", action: logoutAction },
  ];

  function run(item: CommandItem) {
    item.action();
    onClose();
    setQuery("");
  }
  function go(t: TabId) {
    setTab(t);
  }
  function lockAction() {
    lock();
  }
  function logoutAction() {
    logout();
  }

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(filtered.length - 1, h + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      }
      if (e.key === "Enter" && filtered[highlight]) {
        e.preventDefault();
        run(filtered[highlight]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, query, highlight, filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 pt-[16vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong w-[min(560px,92vw)] overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
              <Search className="h-4 w-4 text-ink-faint" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or run a command..."
                className="h-14 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <kbd className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
                ESC
              </kbd>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-ink-faint">
                  No commands found
                </p>
              )}
              {filtered.map((item, i) => {
                return (
                  <button
                    key={item.id}
                    onClick={() => run(item)}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      i === highlight
                        ? "bg-green/10 text-ink"
                        : "text-ink-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        i === highlight ? "bg-green" : "bg-ink-faint"
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.hint && (
                      <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                        {item.hint}
                      </span>
                    )}
                    {i === highlight && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-green/60" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
