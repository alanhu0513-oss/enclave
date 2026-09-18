import { Bell, Menu, Search, ShieldCheck, ChevronRight, PanelLeftOpen, Scan, Activity, Zap, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useApp, type TabId } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";

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
  "account-shield": "Account Shield",
};

export function Topbar({
  onMenu,
  onOpenCommand,
  onOpenNotifications,
  collapsed,
  onToggleCollapsed,
}: TopbarProps) {
  const { tab, setTab, unread } = useApp();
  const { lock } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-[#050507]/85 px-4 backdrop-blur-2xl md:px-6">
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
          className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green/20 via-cyan/20 to-transparent ring-1 ring-cyan/30"
        >
          <ShieldCheck className="h-4 w-4 text-cyan" />
          <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green animate-ping" />
        </motion.span>

        {/* Breadcrumb navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
          <span className="hidden text-xs text-ink-faint sm:inline font-mono">ENCLAVE</span>
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

      {/* Futuristic Telemetry HUD center pill */}
      <div className="hidden lg:flex items-center gap-4 mx-auto rounded-full border border-white/[0.07] bg-white/[0.02] px-4 py-1 text-[11px] font-mono backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-green">
          <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
          <span>MATRIX ONLINE</span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <div className="flex items-center gap-1.5 text-ink-muted">
          <Activity className="h-3 w-3 text-cyan" />
          <span>LIVE SWEEP: <span className="text-ink">1.2B+ RECORDS</span></span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <div className="flex items-center gap-1 text-ink-muted">
          <Zap className="h-3 w-3 text-amber" />
          <span className="text-amber/90">2.8k DEFLECTED TODAY</span>
        </div>
      </div>

      <div className="flex-1 lg:flex-none" />

      {/* Quick Launch Deep Scan button */}
      <button
        onClick={() => setTab("scan")}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan transition-all hover:bg-cyan/20 hover:border-cyan/50 hover:shadow-[0_0_15px_rgba(0,242,254,0.25)]"
      >
        <Scan className="h-3.5 w-3.5" />
        <span>Deep Scan</span>
      </button>

      {/* Command palette trigger */}
      <button
        onClick={onOpenCommand}
        aria-label="Search and commands"
        className="group hidden h-9 w-[190px] items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-ink-faint transition-all duration-200 hover:border-cyan/40 hover:bg-white/[0.06] hover:text-ink-muted xl:flex"
      >
        <Search className="h-3.5 w-3.5 transition-colors group-hover:text-cyan" />
        <span>Command Vault...</span>
        <kbd className="ml-auto rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-ink-muted">
          ⌘K
        </kbd>
      </button>

      {/* Interactive persistent Vault status and lock indicator */}
      <motion.button
        onClick={lock}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-green/20 bg-green/[0.04] px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wider text-green uppercase hover:bg-red/10 hover:border-red/30 hover:text-red transition-all cursor-pointer shadow-[0_0_12px_rgba(5,242,159,0.05)]"
        title="Vault status: ENCRYPTED & ACTIVE. Click to instantly Lock Vault."
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green"></span>
        </span>
        <span className="hidden xs:inline">VAULT UNLOCKED</span>
        <Lock className="h-3 w-3 opacity-60 ml-0.5" />
      </motion.button>

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
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(255,51,102,0.6)]"
          >
            {unread}
          </motion.span>
        )}
      </button>
    </header>
  );
}
