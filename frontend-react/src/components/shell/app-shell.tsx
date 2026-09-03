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
import { OfflineBanner } from "@/components/performance/offline-banner";
import { FadeIn } from "@/components/ui/motion";
import { updateSEO } from "@/lib/seo";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { Loader2, Home, ScanSearch, Bell, Shield, Settings } from "lucide-react";

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
const MLDashboard = lazy(() => import("@/features/ml/ml-dashboard").then((m) => ({ default: m.MLDashboard })));
const ActivityView = lazy(() => import("@/features/activity/activity-view").then((m) => ({ default: m.ActivityView })));
const SettingsView = lazy(() => import("@/features/settings/settings-view").then((m) => ({ default: m.SettingsView })));
const ThreatIntelView = lazy(() => import("@/features/threat-intel/threat-intel-view").then((m) => ({ default: m.ThreatIntelView })));
const EducationView = lazy(() => import("@/features/education/education-view").then((m) => ({ default: m.EducationView })));
const BugBountyView = lazy(() => import("@/features/bug-bounty/bug-bounty-view").then((m) => ({ default: m.BugBountyView })));
const BlogView = lazy(() => import("@/features/blog/blog-view").then((m) => ({ default: m.BlogView })));
const ComparisonView = lazy(() => import("@/features/comparison/comparison-view").then((m) => ({ default: m.ComparisonView })));
const DemoView = lazy(() => import("@/features/demo/demo-view").then((m) => ({ default: m.DemoView })));
const AnalyticsView = lazy(() => import("@/features/analytics/analytics-view").then((m) => ({ default: m.AnalyticsView })));
const PlatformsView = lazy(() => import("@/features/platforms/platforms-view").then((m) => ({ default: m.PlatformsView })));
const ScanHistoryView = lazy(() => import("@/features/scan-history/scan-history-view").then((m) => ({ default: m.ScanHistoryView })));

const COLLAPSE_KEY = "enclave_sidebar_collapsed";

function ViewLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-cyan" />
    </div>
  );
}

export function AppShell() {
  const { tab, setTab, unread } = useApp();
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
    <div className="relative min-h-screen bg-[#111113]">
      <a href="#main-content" className="skip-link">Skip to main content</a>
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
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <Sidebar mobile open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex flex-1">
          <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
          <main
            id="main-content"
            className="relative z-10 flex-1 overflow-visible px-3 pb-24 pt-4 sm:px-4 sm:pt-6 md:px-8 md:pt-8"
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
                {tab === "ml" && <MLDashboard />}
                {tab === "activity" && <ActivityView />}
                {tab === "settings" && <SettingsView />}
                {tab === "threat-intel" && <ThreatIntelView />}
                {tab === "education" && <EducationView />}
                {tab === "bug-bounty" && <BugBountyView />}
                {tab === "blog" && <BlogView />}
                {tab === "comparison" && <ComparisonView />}
                {tab === "demo" && <DemoView />}
                {tab === "analytics" && <AnalyticsView />}
                {tab === "platforms" && <PlatformsView />}
                {tab === "scan-history" && <ScanHistoryView />}
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
      <OfflineBanner />

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.07] bg-surface-0/90 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { id: "home", icon: Home, label: "Home" },
            { id: "scan", icon: ScanSearch, label: "Scan" },
            { id: "alerts", icon: Bell, label: "Alerts", badge: unread },
            { id: "shield", icon: Shield, label: "Shields" },
            { id: "settings", icon: Settings, label: "Settings" },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id as any)}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] transition-colors ${
                  active ? "text-green" : "text-ink-faint"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-green" : "text-ink-faint"}`} />
                <span>{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[9px] font-bold text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
