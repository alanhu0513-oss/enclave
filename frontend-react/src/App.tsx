import { AuthProvider, useAuth } from "@/lib/auth";
import { AppProvider } from "@/lib/app-context";
import { AppShell } from "@/components/shell/app-shell";
import { AuthView } from "@/features/auth/auth-view";
import { LockView } from "@/features/auth/lock-view";
import { captureReferralCode } from "@/lib/referral";

captureReferralCode();

function Gate() {
  const { user, locked } = useAuth();

  if (!user) {
    return <AuthView />;
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
