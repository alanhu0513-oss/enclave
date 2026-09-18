import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Unlock, Loader2, ShieldAlert, Fingerprint, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LockView() {
  const { unlock, logout, user, loginBiometrics, verifyPassword } = useAuth();
  const { tab, setTab } = useApp();
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [unlockedState, setUnlockedState] = useState(false);
  const [error, setError] = useState("");
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Store the target location the user was trying to access or had active before locking
  const [returnTab] = useState<any>(() => {
    try {
      const urlTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
      if (urlTab) return urlTab;
      const savedLockedTab = sessionStorage.getItem("enclave_locked_tab");
      if (savedLockedTab) return savedLockedTab;
      const activeTab = sessionStorage.getItem("enclave_active_tab");
      return activeTab || tab || "home";
    } catch {
      return tab || "home";
    }
  });

  useEffect(() => {
    if (!sessionStorage.getItem("enclave_locked_tab")) {
      sessionStorage.setItem("enclave_locked_tab", tab || "home");
    }
  }, [tab]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 30,
        y: (e.clientY / window.innerHeight - 0.5) * 30,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (checking || biometricScanning || unlockedState) return;
    setChecking(true);
    setError("");
    try {
      // 1. Verify credentials with backend
      const valid = await verifyPassword(password);
      if (!valid) {
        throw new Error("Verification failed. Incorrect primary password.");
      }

      // 2. Show unlocking success UI state
      setUnlockedState(true);

      // 3. Restore requested location
      const target = returnTab || sessionStorage.getItem("enclave_locked_tab") || "home";
      setTab(target);
      sessionStorage.removeItem("enclave_locked_tab");

      // 4. Complete session unlock after smooth feedback animation
      setTimeout(async () => {
        try {
          await unlock(password);
        } catch {
          // If already unlocked
        }
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Verification failed. Incorrect primary password.");
    } finally {
      setChecking(false);
    }
  }

  async function handleBiometricScan() {
    if (biometricScanning || checking || unlockedState) return;
    setBiometricScanning(true);
    setError("");
    try {
      if (!user?.email) {
        throw new Error("No active email associated with this session.");
      }
      // Call the fully synchronized cryptographic WebAuthn verify sequence
      await loginBiometrics(user.email);
      setUnlockedState(true);

      // Restore requested location
      const target = returnTab || sessionStorage.getItem("enclave_locked_tab") || "home";
      setTab(target);
      sessionStorage.removeItem("enclave_locked_tab");
    } catch (err: any) {
      setError(err?.message || "Biometric alignment mismatch. Please enter password.");
    } finally {
      setBiometricScanning(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 bg-[#030305]">
      {/* Dynamic Ambient Fluid background */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: unlockedState 
            ? "radial-gradient(circle at 50% 50%, rgba(5,242,159,0.08) 0%, transparent 60%)"
            : biometricScanning
              ? "radial-gradient(circle at 50% 50%, rgba(0,242,254,0.1) 0%, transparent 55%)"
              : "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.05) 0%, transparent 70%)"
        }}
        transition={{ duration: 1 }}
      />

      {/* Parallax Cyber Grid reactive to mouse pointer */}
      <div 
        className="absolute inset-0 transition-transform duration-500 ease-out opacity-25 pointer-events-none"
        style={{
          transform: `translate3d(${mousePosition.x}px, ${mousePosition.y}px, 0) scale(1.05)`,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px"
        }}
      />

      <div className="relative w-full max-w-md z-10">
        <AnimatePresence mode="wait">
          {!unlockedState ? (
            <motion.div
              key="lock-card"
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center border border-white/[0.04] bg-[#06070a]/80 backdrop-blur-3xl rounded-3xl p-8 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
            >
              {/* Spinning Decryption Keyring HUD */}
              <div className="mb-8 relative flex items-center justify-center h-24 w-24">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute h-24 w-24 rounded-full border border-dashed border-white/[0.03]"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute h-20 w-20 rounded-full border border-dashed border-cyan/15"
                />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] shadow-inner">
                  <motion.div
                    animate={biometricScanning ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Lock className="h-6 w-6 text-ink opacity-80" />
                  </motion.div>
                </div>
                {/* Active Indicator beacon */}
                <span className="absolute bottom-1 right-1 flex h-3 w-3">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${biometricScanning ? "bg-cyan" : "bg-cyan/40"}`} />
                  <span className={`relative inline-flex h-3 w-3 rounded-full border border-black/40 ${biometricScanning ? "bg-cyan" : "bg-cyan"}`} />
                </span>
              </div>

              {/* Security Header */}
              <div className="text-center space-y-1 mb-8">
                <h1 className="font-mono text-[10px] font-extrabold text-ink-muted uppercase tracking-[0.25em]">
                  ENCLAVE SECURE DECRYPTION
                </h1>
                <p className="text-[13px] text-ink-faint font-light">
                  Welcome back, <span className="text-ink font-normal">{user?.fullName || "User"}</span>. Session lock active.
                </p>
              </div>

              {/* Biometric Scan Trigger Block */}
              <div className="mb-8 flex flex-col items-center relative w-full">
                {/* Magnetic Waves */}
                <AnimatePresence>
                  {biometricScanning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <motion.div 
                        initial={{ scale: 0.6, opacity: 0.8 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                        className="absolute h-28 w-28 rounded-full border border-cyan/30"
                      />
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1.4, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, delay: 0.5, repeat: Infinity, ease: "easeOut" }}
                        className="absolute h-28 w-28 rounded-full border border-cyan/20"
                      />
                    </div>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0px 0px 40px rgba(0, 242, 254, 0.25)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBiometricScan}
                  disabled={biometricScanning || checking}
                  className={`relative flex h-24 w-24 flex-col items-center justify-center rounded-full border transition-all duration-500 cursor-pointer ${
                    biometricScanning 
                      ? "border-cyan bg-cyan/15 text-cyan shadow-[0_0_35px_rgba(0,242,254,0.3)]" 
                      : "border-white/[0.08] bg-white/[0.01] hover:border-cyan/40 hover:bg-cyan/[0.03]"
                  }`}
                >
                  {/* Glowing line animation mimicking biometrics scanning */}
                  {biometricScanning && (
                    <motion.div
                      initial={{ y: -35 }}
                      animate={{ y: 35 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
                      className="absolute inset-x-3 h-[2px] bg-cyan shadow-[0_0_12px_#00F2FE] rounded-full z-10"
                    />
                  )}

                  <Fingerprint className={`h-10 w-10 transition-all duration-300 ${
                    biometricScanning ? "text-cyan scale-110" : "text-ink-muted group-hover:text-cyan"
                  }`} />
                  
                  {/* Active Outer Ring */}
                  <div className={`absolute -inset-1 rounded-full border border-white/[0.03] transition-all duration-500 group-hover:border-cyan/20 ${
                    biometricScanning ? "animate-spin border-t-cyan border-r-cyan border-cyan/10" : ""
                  }`} />
                </motion.button>

                <button 
                  type="button" 
                  onClick={handleBiometricScan}
                  className="mt-4 font-mono text-[9px] uppercase tracking-widest text-cyan font-bold flex items-center gap-1.5 hover:text-white transition-all cursor-pointer"
                >
                  {biometricScanning ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-cyan" />
                      Decrypting Enclave Key...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 animate-pulse text-cyan" />
                      Engage platform biometrics
                    </span>
                  )}
                </button>
              </div>

              {/* Form Divider */}
              <div className="relative w-full mb-6 flex items-center justify-center font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                <div className="absolute inset-x-0 h-[1px] bg-white/[0.04]" />
                <span className="relative px-3 bg-[#06070a]/80 backdrop-blur-xl">Or enter key</span>
              </div>

              {/* Password Decryption Entry */}
              <form onSubmit={submit} className="w-full space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Enter Master Password"
                    className="pl-10 text-center font-mono h-11 border-white/[0.06] bg-[#0b0c10]/40 focus-visible:ring-cyan/30 focus-visible:border-cyan/30 rounded-xl"
                    required
                    autoFocus
                    disabled={checking || biometricScanning}
                  />
                </div>
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-xl border border-red/20 bg-red/[0.02] px-3.5 py-2.5 text-left text-xs text-red"
                  >
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red/80" />
                    <span className="font-light leading-snug">{error}</span>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={logout} 
                    className="flex-1 text-ink-muted border-white/[0.06] hover:bg-white/[0.02] h-10 rounded-xl"
                    disabled={checking || biometricScanning}
                  >
                    Log Out
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-cyan text-black hover:bg-cyan/90 font-semibold h-10 rounded-xl shadow-[0_4px_12px_rgba(0,242,254,0.12)]" 
                    disabled={checking || biometricScanning}
                  >
                    {checking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <Unlock className="h-3.5 w-3.5" />
                        Unlock
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="unlock-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center border border-green/20 bg-[#050907]/90 backdrop-blur-3xl rounded-3xl p-10 text-center shadow-[0_30px_100px_rgba(5,242,159,0.15)]"
            >
              <motion.div 
                initial={{ scale: 0.5, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="h-16 w-16 rounded-full bg-green/10 border border-green/35 flex items-center justify-center text-green mb-6"
              >
                <CheckCircle2 className="h-8 w-8 text-green animate-pulse" />
              </motion.div>
              <h2 className="font-mono text-[10px] font-extrabold text-green uppercase tracking-[0.25em] mb-1">
                Vault Decryption Complete
              </h2>
              <p className="text-[13px] text-ink-muted font-light max-w-xs leading-relaxed">
                Platform identity keys synchronized. Returning to {returnTab && returnTab !== "home" ? `your ${String(returnTab).replace("-", " ")} workspace` : "primary dashboard"}...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
