import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppProvider } from "@/lib/app-context";
import { AppShell } from "@/components/shell/app-shell";
import { AuthView } from "@/features/auth/auth-view";
import { LockView } from "@/features/auth/lock-view";
import { LandingPage } from "@/features/landing/landing-page";
import { captureReferralCode } from "@/lib/referral";

captureReferralCode();

function Gate() {
  const { user, locked } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

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
