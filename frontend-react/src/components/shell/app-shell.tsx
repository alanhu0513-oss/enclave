import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { NotificationsPanel } from "./notifications-panel";
import { HaikeiBackground } from "./haikei-background";
import { useApp } from "@/lib/app-context";
import { HomeView } from "@/features/home/home-view";
import { ShieldsView } from "@/features/shields/shields-view";
import { ScanView } from "@/features/scan/scan-view";
import { AlertsView } from "@/features/alerts/alerts-view";
import { InsightsView } from "@/features/insights/insights-view";
import { ReportsView } from "@/features/reports/reports-view";
import { MonitoringView } from "@/features/monitoring/monitoring-view";
import { SettingsView } from "@/features/settings/settings-view";
import {
  OnboardingWizard,
  hasCompletedOnboarding,
} from "@/features/onboarding/onboarding-wizard";
import { FadeIn } from "@/components/ui/motion";

const COLLAPSE_KEY = "enclave_sidebar_collapsed";

export function AppShell() {
  const { tab } = useApp();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });

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
    <div className="relative min-h-screen bg-[#04060a]">
      {/* Haikei layered background (behind everything) */}
      <HaikeiBackground />

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
          <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
          <main
            className="relative z-10 flex-1 overflow-visible px-4 pb-24 pt-6 md:px-8 md:pt-8"
            role="main"
          >
            <FadeIn key={tab}>
              {tab === "home" && <HomeView />}
              {tab === "shield" && <ShieldsView />}
              {tab === "scan" && <ScanView />}
              {tab === "alerts" && <AlertsView />}
              {tab === "insights" && <InsightsView />}
              {tab === "reports" && <ReportsView />}
              {tab === "monitoring" && <MonitoringView />}
              {tab === "settings" && <SettingsView />}
            </FadeIn>
          </main>
        </div>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      {!hasCompletedOnboarding() && <OnboardingWizard />}
    </div>
  );
}
