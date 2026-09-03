import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppProvider } from "@/lib/app-context";
import { AppShell } from "@/components/shell/app-shell";
import { AuthView } from "@/features/auth/auth-view";
import { LockView } from "@/features/auth/lock-view";
import { LandingPage } from "@/features/landing/landing-page";
import { TermsOfService } from "@/pages/terms-of-service";
import { PrivacyPolicy } from "@/pages/privacy-policy";
import { DmcaPolicy } from "@/pages/dmca-policy";
import { NotFoundPage } from "@/pages/not-found";
import { captureReferralCode } from "@/lib/referral";

captureReferralCode();

function Gate() {
  const { user, locked } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [page, setPage] = useState<string>("");

  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/terms" || path === "/privacy" || path === "/dmca") {
      setPage(path.slice(1));
    } else if (path === "/404") {
      setPage("404");
    } else {
      setPage("");
    }
    const onPop = () => {
      const p = window.location.pathname;
      if (p === "/terms" || p === "/privacy" || p === "/dmca") {
        setPage(p.slice(1));
      } else if (p === "/404") {
        setPage("404");
      } else {
        setPage("");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (page === "terms") return <TermsOfService />;
  if (page === "privacy") return <PrivacyPolicy />;
  if (page === "dmca") return <DmcaPolicy />;
  if (page === "404") return <NotFoundPage />;

  if (!user && !showAuth) {
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  if (!user && showAuth) {
    return <AuthView onBack={() => setShowAuth(false)} />;
  }

  if (locked) {
    return <LockView />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Gate />
      </AppProvider>
    </AuthProvider>
  );
}
