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
    <div className="relative min-h-screen overflow-hidden bg-[#04060a]">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/3 w-48 h-48 bg-cyan/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-purple/5 rounded-full blur-3xl animate-pulse"></div>
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Topbar
          onMenu={() => setMobileNavOpen(true)}
          onOpenCommand={() => {
            setNotifOpen(false);
            setCommandOpen(true);
          }}
          onOpenNotifications={() => setNotifOpen((o) => !o)}
        />
        <Sidebar mobile open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8" role="main">
            <FadeIn key={tab}>
              {tab === "home" && <HomeView />}
              {tab === "shield" && <ShieldsView />}
              {tab === "scan" && <ScanView />}
              {tab === "alerts" && <AlertsView />}
              {tab === "insights" && <InsightsView />}
              {tab === "settings" && <SettingsView />}
            </FadeIn>
          </main>
        </div>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
