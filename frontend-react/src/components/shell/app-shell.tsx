import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { NotificationsPanel } from "./notifications-panel";
import { useApp } from "@/lib/app-context";
import { HomeView } from "@/features/home/home-view";
import { ShieldsView } from "@/features/shields/shields-view";
import { ScanView } from "@/features/scan/scan-view";
import { AlertsView } from "@/features/alerts/alerts-view";
import { InsightsView } from "@/features/insights/insights-view";
import { SettingsView } from "@/features/settings/settings-view";
import { FadeIn } from "@/components/ui/motion";

export function AppShell() {
  const { tab } = useApp();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex min-h-screen">
      <div className="vault-bg" />
      <div className="vault-grid" />

      <Sidebar
        mobile
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setMobileNavOpen(true)}
          onOpenCommand={() => {
            setNotifOpen(false);
            setCommandOpen(true);
          }}
          onOpenNotifications={() => setNotifOpen((o) => !o)}
        />
        <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <FadeIn key={tab}>
            {tab === "home" && <HomeView />}
            {tab === "shield" && <ShieldsView />}
            {tab === "scan" && <ScanView />}
            {tab === "alerts" && <AlertsView />}
            {tab === "insights" && <InsightsView />}
            {tab === "settings" && <SettingsView />}
          </FadeIn>
        </main>

        <footer className="border-t border-white/[0.06] px-6 py-5 text-center text-xs text-ink-faint">
          ENCLAVE · Digital Identity Protection Vault
        </footer>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
