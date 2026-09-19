import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import { TakedownDetail } from "@/pages/takedown-detail";
import { captureReferralCode } from "@/lib/referral";
import { getToken } from "@/lib/api";

captureReferralCode();

function Gate() {
  const { user, locked, lock, initialized } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [page, setPage] = useState<string>("");

  // Auto-Lock Vault on 5 minutes (300,000ms) of user inactivity
  useEffect(() => {
    if (!user || locked || !initialized) return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        console.log("[Enclave] Auto-locking vault due to 5 minutes of inactivity.");
        lock();
      }, 300000); // 5 minutes
    };

    // Initialize timer
    resetTimer();

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click"
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, locked, lock, initialized]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/terms" || path === "/privacy" || path === "/dmca") {
      setPage(path.slice(1));
    } else if (path.startsWith("/takedown/")) {
        setPage("takedown");
    } else if (path === "/404") {
      setPage("404");
    } else {
      setPage("");
    }
    const onPop = () => {
      const p = window.location.pathname;
      if (p === "/terms" || p === "/privacy" || p === "/dmca") {
        setPage(p.slice(1));
      } else if (p.startsWith("/takedown/")) {
        setPage("takedown");
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
  if (page === "takedown") return <TakedownDetail />;
  if (page === "404") return <NotFoundPage />;

  // 1. Verify AuthProvider is fully initialized and token check is complete
  if (!initialized) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#030305] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan/20 bg-cyan/5 backdrop-blur-xl">
            <Loader2 className="h-7 w-7 animate-spin text-cyan" />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
            Initializing Enclave Vault...
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated flows
  const token = getToken();
  if ((!user || !token) && !showAuth) {
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  if ((!user || !token) && showAuth) {
    return <AuthView onBack={() => setShowAuth(false)} />;
  }

  // 3. Vault Lock Screen
  if (locked) {
    return <LockView />;
  }

  // 4. Fully authenticated and verified protected application shell
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
