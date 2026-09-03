import { Bell, Menu, Search, ShieldCheck, ChevronRight, PanelLeftOpen } from "lucide-react";
import { motion } from "motion/react";
import { useApp, type TabId } from "@/lib/app-context";

interface TopbarProps {
  onMenu: () => void;
  onOpenCommand: () => void;
  onOpenNotifications: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const TITLES: Record<TabId, string> = {
  home: "Command Center",
  shield: "Active Shields",
  scan: "Deep Scan",
  alerts: "Alert Center",
  insights: "Intelligence",
  monitoring: "Live Monitoring",
  reports: "Reports & Analytics",
  enterprise: "Enterprise",
  admin: "Admin Dashboard",
  family: "Family Dashboard",
  "shield-dashboard": "Shield Hub",
  insurance: "Deepfake Insurance",
  passport: "Identity Passport",
  bounty: "Deepfake Bounty",
  estate: "Digital Estate",
  ml: "ML Command Center",
  activity: "Activity Timeline",
  settings: "Vault Settings",
  "threat-intel": "Threat Intelligence",
  education: "Education Center",
  blog: "Blog & Insights",
  comparison: "Why Enclave?",
  demo: "See It In Action",
  analytics: "Analytics Dashboard",
  "bug-bounty": "Bug Bounty",
  platforms: "Platform Coverage",
  "scan-history": "Scan History",
};

export function Topbar({
  onMenu,
  onOpenCommand,
  onOpenNotifications,
  collapsed,
  onToggleCollapsed,
}: TopbarProps) {
  const { tab, unread } = useApp();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-surface-0/80 px-4 backdrop-blur-xl md:px-6">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/[0.07] hover:text-ink md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop expand sidebar button */}
      {collapsed && onToggleCollapsed && (
        <button
          onClick={onToggleCollapsed}
          className="hidden rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/[0.07] hover:text-ink md:block"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
      )}

      <div className="flex items-center gap-2">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green/20 to-cyan/20 ring-1 ring-green/20"
        >
          <ShieldCheck className="h-4 w-4 text-green" />
        </motion.span>

        {/* Breadcrumb navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
          <span className="hidden text-xs text-ink-faint sm:inline">Enclave</span>
          <ChevronRight className="hidden h-3 w-3 text-ink-faint/50 sm:inline" />
          <motion.h1
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="font-display text-sm font-semibold tracking-tight text-ink sm:text-[15px]"
          >
            {TITLES[tab]}
          </motion.h1>
        </nav>
      </div>

      <div className="flex-1" />

      {/* Command palette trigger */}
      <button
        onClick={onOpenCommand}
        aria-label="Search and commands"
        className="group hidden h-10 w-[240px] items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-ink-faint transition-all duration-200 hover:border-green/30 hover:bg-white/[0.05] hover:text-ink-muted md:flex"
      >
        <Search className="h-4 w-4 transition-colors group-hover:text-green" />
        <span>Search & commands...</span>
        <kbd className="ml-auto rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      {/* Notification bell */}
      <button
        onClick={onOpenNotifications}
        className="relative rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </motion.span>
        )}
      </button>
    </header>
  );
}
