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
  Radar,
  Users,
  IdCard,
  DollarSign,
  Heart,
  Brain,
  Activity,
  Globe,
  GraduationCap,
  BookOpen,
  ChevronRight,
  Menu,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp, type TabId } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { ShieldMark } from "@/components/ui/logo";
import { PlanModal } from "./plan-modal";
import { useState, useEffect, useMemo } from "react";

interface NavItem {
  id: TabId;
  label: string;
  icon: typeof Home;
  plans?: string[];
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: "home", label: "Home", icon: Home },
      { id: "scan", label: "Scan", icon: ScanSearch },
      { id: "alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "Protection",
    items: [
      { id: "shield", label: "Shields", icon: Shield },
      { id: "monitoring", label: "Monitoring", icon: Radar },
      { id: "threat-intel", label: "Threat Intel", icon: Globe },
      { id: "platforms", label: "Platforms", icon: Globe },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "reports", label: "Reports", icon: FileText },
      { id: "activity", label: "Activity", icon: Activity },
      { id: "scan-history", label: "Scan History", icon: History },
      { id: "education", label: "Education", icon: GraduationCap },
    ],
  },
  {
    label: "Premium",
    items: [
      { id: "family", label: "Family", icon: Users, plans: ["family"] },
      { id: "insurance", label: "Insurance", icon: Shield, plans: ["pro", "shield", "family", "business"] },
      { id: "passport", label: "Passport", icon: IdCard, plans: ["pro", "shield", "family", "business"] },
      { id: "bounty", label: "Bounty", icon: DollarSign, plans: ["pro", "shield", "family", "business"] },
      { id: "estate", label: "Estate", icon: Heart, plans: ["pro", "shield", "family", "business"] },
      { id: "ml", label: "ML Command", icon: Brain, plans: ["pro", "shield", "family", "business"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "blog", label: "Blog", icon: BookOpen },
      { id: "enterprise", label: "Enterprise", icon: Shield, plans: ["business"] },
      { id: "admin", label: "Admin", icon: BarChart3, plans: ["business"] },
    ],
  },
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["Premium", "Admin"]));

  const filteredSections = useMemo(() => {
    const plan = user?.plan || "free";
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.plans) return true;
        return item.plans.includes(plan);
      }),
    })).filter((section) => section.items.length > 0);
  }, [user?.plan]);

  useEffect(() => {
    const openPlans = () => setPlanModalOpen(true);
    window.addEventListener("enclave:open-plans", openPlans);
    return () => window.removeEventListener("enclave:open-plans", openPlans);
  }, []);

  const initials = (user?.fullName || user?.email || "U")
    .slice(0, 2)
    .toUpperCase();

  const effectiveCollapsed = !mobile && collapsed;

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

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
          width: effectiveCollapsed ? 72 : 260,
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
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-white/[0.07] hover:text-ink",
                effectiveCollapsed ? "hidden" : ""
              )}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {effectiveCollapsed && (
          <div className="flex justify-center px-2 pb-2">
            <button
              onClick={onToggleCollapsed}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-white/[0.07] hover:text-ink"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav role="navigation" aria-label="Main navigation" className="mt-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
          {filteredSections.map((section, sIdx) => (
            <div key={sIdx} className={cn(sIdx > 0 && "mt-2")}>
              {section.label && !effectiveCollapsed && (
                <button
                  onClick={() => toggleSection(section.label!)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint/60 hover:text-ink-faint"
                >
                  {section.label}
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 transition-transform",
                      expandedSections.has(section.label!) && "rotate-90"
                    )}
                  />
                </button>
              )}
              {(effectiveCollapsed || !section.label || expandedSections.has(section.label!)) &&
                section.items.map((item) => {
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
                      aria-label={effectiveCollapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-out",
                        effectiveCollapsed && "justify-center px-2",
                        active
                          ? "text-ink bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          : "text-ink-muted hover:text-ink hover:bg-white/[0.04]"
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
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-green" />
                      )}
                      <Icon
                        className={cn(
                          "relative z-10 h-[18px] w-[18px] shrink-0 transition-colors duration-200",
                          active ? "text-green" : "text-ink-faint group-hover:text-ink-muted"
                        )}
                      />
                      {!effectiveCollapsed && (
                        <span className="relative z-10 whitespace-nowrap text-shadow-sm">{item.label}</span>
                      )}
                      {item.id === "alerts" && unread > 0 && (
                        <span className="absolute right-2 top-1/2 z-10 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* Bottom: user + lock */}
        <div className="border-t border-white/[0.07] p-3">
          {effectiveCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setPlanModalOpen(true)}
                aria-label="Open plan details"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-green to-cyan text-xs font-bold text-black transition-all hover:scale-105"
              >
                {initials}
              </button>
              <button
                onClick={() => setTab("settings")}
                title="Settings"
                aria-label="Settings"
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-white/[0.07] hover:text-ink"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={lock}
                title="Lock Vault"
                aria-label="Lock vault"
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-white/[0.07] hover:text-ink"
              >
                <Lock className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl px-2 py-2">
              <button
                onClick={() => setPlanModalOpen(true)}
                aria-label="Open plan details"
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
                onClick={() => setTab("settings")}
                title="Settings"
                aria-label="Settings"
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-white/[0.07] hover:text-ink"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={lock}
                title="Lock Vault"
                aria-label="Lock vault"
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
