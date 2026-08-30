import { motion } from "motion/react";
import {
  Home,
  Shield,
  ScanSearch,
  Bell,
  BarChart3,
  FileText,
  Settings,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp, type TabId } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { ShieldMark } from "@/components/ui/logo";
import { PlanModal } from "./plan-modal";
import { useState, useEffect } from "react";

const NAV: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "shield", label: "Shields", icon: Shield },
  { id: "scan", label: "Scan", icon: ScanSearch },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  mobile?: boolean;
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({
  mobile = false,
  open,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const { tab, setTab, unread } = useApp();
  const { user, lock } = useAuth();
  const [planModalOpen, setPlanModalOpen] = useState(false);

  useEffect(() => {
    const openPlans = () => setPlanModalOpen(true);
    window.addEventListener("enclave:open-plans", openPlans);
    return () => window.removeEventListener("enclave:open-plans", openPlans);
  }, []);

  const initials = (user?.fullName || user?.email || "U")
    .slice(0, 2)
    .toUpperCase();

  const effectiveCollapsed = !mobile && collapsed;

  return (
    <>
      {mobile && (
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0 }}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <motion.aside
        initial={false}
        animate={{
          x: !open && mobile ? "-100%" : 0,
          opacity: 1,
          width: effectiveCollapsed ? 76 : 260,
        }}
        transition={{
          width: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
          x: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-white/[0.07] bg-surface-1/95 backdrop-blur-xl md:sticky md:top-0 md:h-screen",
          mobile ? "md:hidden" : "hidden md:flex"
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-16 items-center justify-between px-5",
            effectiveCollapsed && "justify-center px-2"
          )}
        >
          <div className="flex items-center gap-2.5">
            <ShieldMark size={28} />
            {!effectiveCollapsed && (
              <span className="font-display text-[15px] font-bold tracking-[0.26em] text-ink">
                ENCLAVE
              </span>
            )}
          </div>
          {!mobile && (
            <button
              onClick={onToggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-white/[0.07] hover:text-ink",
                effectiveCollapsed ? "hidden" : ""
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  onClose?.();
                }}
                title={effectiveCollapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  effectiveCollapsed && "justify-center px-2",
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                )}
              >
                {active && (
                  <motion.span
                    layoutId={mobile ? "mobile-nav-pill" : "nav-pill"}
                    className="absolute inset-0 rounded-xl bg-white/[0.06]"
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-green to-cyan" />
                )}
                <Icon
                  className={cn(
                    "relative z-10 h-[18px] w-[18px] shrink-0 transition-colors",
                    active ? "text-green" : "text-ink-faint group-hover:text-ink-muted"
                  )}
                />
                {!effectiveCollapsed && (
                  <span className="relative z-10 whitespace-nowrap">{item.label}</span>
                )}
                {item.id === "alerts" && unread > 0 && (
                  <span className="absolute right-2 top-1/2 z-10 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: user + lock */}
        <div className="border-t border-white/[0.07] p-3">
          {effectiveCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setPlanModalOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-green to-cyan text-xs font-bold text-black transition-all hover:scale-105"
              >
                {initials}
              </button>
              <button
                onClick={lock}
                title="Lock Vault"
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-white/[0.07] hover:text-ink"
              >
                <Lock className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <button
                onClick={() => setPlanModalOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-green to-cyan text-xs font-bold text-black transition-all hover:scale-105"
              >
                {initials}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {user?.fullName || "User"}
                </p>
                <p className="text-xs text-ink-faint">
                  {(user?.plan || "free").toUpperCase()} PLAN
                </p>
              </div>
              <button
                onClick={lock}
                title="Lock Vault"
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-white/[0.07] hover:text-ink"
              >
                <Lock className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      <PlanModal open={planModalOpen} onClose={() => setPlanModalOpen(false)} />
    </>
  );
}
