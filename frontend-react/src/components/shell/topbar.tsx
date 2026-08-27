import { Bell, Menu, Search, ShieldCheck } from "lucide-react";
import { useApp, type TabId } from "@/lib/app-context";

interface TopbarProps {
  onMenu: () => void;
  onOpenCommand: () => void;
  onOpenNotifications: () => void;
}

const TITLES: Record<TabId, string> = {
  home: "Command Center",
  shield: "Active Shields",
  scan: "Deep Scan",
  alerts: "Alert Center",
  insights: "Intelligence",
  settings: "Vault Settings",
};

export function Topbar({
  onMenu,
  onOpenCommand,
  onOpenNotifications,
}: TopbarProps) {
  const { tab, unread } = useApp();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-surface-0/80 px-4 backdrop-blur-xl md:px-6">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/[0.07] hover:text-ink md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center gap-2 sm:flex">
        <ShieldCheck className="h-5 w-5 text-green" />
        <h1 className="font-display text-[15px] font-semibold tracking-tight text-ink">
          {TITLES[tab]}
        </h1>
      </div>

      <div className="flex-1" />

      {/* Command palette trigger */}
      <button
        onClick={onOpenCommand}
        className="hidden h-10 w-[240px] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-ink-faint transition-colors hover:border-green/30 hover:text-ink-muted md:flex"
      >
        <Search className="h-4 w-4" />
        <span>Search & commands...</span>
        <kbd className="ml-auto rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      {/* Notification bell */}
      <button
        onClick={onOpenNotifications}
        className="relative rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
    </header>
  );
}
