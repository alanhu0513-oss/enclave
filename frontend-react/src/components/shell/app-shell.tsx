import { Suspense, lazy, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { NotificationsPanel } from "./notifications-panel";
import { HaikeiBackground } from "./haikei-background";
import { useApp } from "@/lib/app-context";
import {
  OnboardingWizard,
  hasCompletedOnboarding,
} from "@/features/onboarding/onboarding-wizard";
import { FeedbackWidget } from "@/features/feedback/feedback-widget";
import { NpsSurvey } from "@/features/feedback/nps-survey";
import { FadeIn } from "@/components/ui/motion";
import { updateSEO } from "@/lib/seo";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { Loader2 } from "lucide-react";

const HomeView = lazy(() => import("@/features/home/home-view").then((m) => ({ default: m.HomeView })));
const ShieldsView = lazy(() => import("@/features/shields/shields-view").then((m) => ({ default: m.ShieldsView })));
const ScanView = lazy(() => import("@/features/scan/scan-view").then((m) => ({ default: m.ScanView })));
const AlertsView = lazy(() => import("@/features/alerts/alerts-view").then((m) => ({ default: m.AlertsView })));
const InsightsView = lazy(() => import("@/features/insights/insights-view").then((m) => ({ default: m.InsightsView })));
const ReportsView = lazy(() => import("@/features/reports/reports-view").then((m) => ({ default: m.ReportsView })));
const MonitoringView = lazy(() => import("@/features/monitoring/monitoring-view").then((m) => ({ default: m.MonitoringView })));
const EnterpriseView = lazy(() => import("@/features/enterprise/enterprise-view").then((m) => ({ default: m.EnterpriseView })));
const AdminDashboard = lazy(() => import("@/features/admin/admin-dashboard").then((m) => ({ default: m.AdminDashboard })));
const FamilyDashboard = lazy(() => import("@/features/family/family-dashboard").then((m) => ({ default: m.FamilyDashboard })));
const ShieldDashboard = lazy(() => import("@/features/shield/shield-dashboard").then((m) => ({ default: m.ShieldDashboard })));
const InsuranceView = lazy(() => import("@/features/insurance/insurance-view").then((m) => ({ default: m.InsuranceView })));
const PassportView = lazy(() => import("@/features/passport/passport-view").then((m) => ({ default: m.PassportView })));
const BountyView = lazy(() => import("@/features/bounty/bounty-view").then((m) => ({ default: m.BountyView })));
const EstateView = lazy(() => import("@/features/estate/estate-view").then((m) => ({ default: m.EstateView })));
const ActivityView = lazy(() => import("@/features/activity/activity-view").then((m) => ({ default: m.ActivityView })));
const SettingsView = lazy(() => import("@/features/settings/settings-view").then((m) => ({ default: m.SettingsView })));

const COLLAPSE_KEY = "enclave_sidebar_collapsed";

function ViewLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-cyan" />
    </div>
  );
}

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
    updateSEO(window.location.pathname);
  }, [tab]);

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
      <SeoJsonLd />
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
              <Suspense fallback={<ViewLoader />}>
                {tab === "home" && <HomeView />}
                {tab === "shield" && <ShieldsView />}
                {tab === "scan" && <ScanView />}
                {tab === "alerts" && <AlertsView />}
                {tab === "insights" && <InsightsView />}
                {tab === "reports" && <ReportsView />}
                {tab === "monitoring" && <MonitoringView />}
                {tab === "enterprise" && <EnterpriseView />}
                {tab === "admin" && <AdminDashboard />}
                {tab === "family" && <FamilyDashboard />}
                {tab === "shield-dashboard" && <ShieldDashboard />}
                {tab === "insurance" && <InsuranceView />}
                {tab === "passport" && <PassportView />}
                {tab === "bounty" && <BountyView />}
                {tab === "estate" && <EstateView />}
                {tab === "activity" && <ActivityView />}
                {tab === "settings" && <SettingsView />}
              </Suspense>
            </FadeIn>
          </main>
        </div>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      {!hasCompletedOnboarding() && <OnboardingWizard />}
      <FeedbackWidget />
      <NpsSurvey />
    </div>
  );
}
