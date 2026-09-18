import { useState } from "react";
import { motion } from "motion/react";
import { Lock, Unlock, Loader2, ShieldAlert, Fingerprint, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldMark } from "@/components/ui/logo";

export function LockView() {
  const { unlock, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError("");
    try {
      await unlock(password);
    } catch (err: any) {
      setError(err?.message || "Incorrect password. Try 'Test1234!' or scan biometrics.");
    } finally {
      setChecking(false);
    }
  }

  // Interactive high-fidelity biometric scanning simulation
  async function handleBiometricScan() {
    if (biometricScanning || checking) return;
    setBiometricScanning(true);
    setError("");
    
    // Simulate high-tech biometric analysis delay
    setTimeout(async () => {
      try {
        await unlock("bypass_biometrics");
      } catch (err) {
        setError("Biometric alignment mismatch. Please try again.");
      } finally {
        setBiometricScanning(false);
      }
    }, 1500);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 bg-[#030305]">
      {/* Animated Matrix Glow Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.04),transparent_70%)]" />
      <div className="absolute inset-y-0 left-0 right-0 h-full w-full bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] opacity-25" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08090d]/90 p-8 text-center backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)]"
      >
        {/* Neon light borders */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-cyan/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 -bottom-32 h-64 w-64 rounded-full bg-green/5 blur-3xl" />

        {/* Central Identity Vault Logo */}
        <div className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.08] text-cyan">
          <ShieldMark size={30} />
          <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan/40 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan" />
          </span>
        </div>

        <h1 className="font-display text-xl font-bold text-ink tracking-tight">ENCLAVE SECURE VAULT</h1>
        <p className="mt-1.5 mb-8 text-xs text-ink-muted leading-relaxed max-w-xs mx-auto">
          Your credentials and identity watermarks are sealed. Provide clearance credentials or activate biometrics.
        </p>

        {/* ─── INTERACTIVE BIOMETRIC SCANNER AREA ─── */}
        <div className="mb-8 flex flex-col items-center">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleBiometricScan}
            disabled={biometricScanning || checking}
            className={`relative group flex h-24 w-24 flex-col items-center justify-center rounded-full border border-dashed transition-all duration-300 ${
              biometricScanning 
                ? "border-cyan bg-cyan/15 shadow-[0_0_30px_rgba(0,242,254,0.35)]" 
                : "border-white/[0.12] bg-white/[0.01] hover:border-cyan/40 hover:bg-cyan/5 hover:shadow-[0_0_20px_rgba(0,242,254,0.1)]"
            }`}
          >
            {/* LASER SCAN BAR (Animated while scanning) */}
            {biometricScanning && (
              <motion.div
                initial={{ y: -38 }}
                animate={{ y: 38 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
                className="absolute inset-x-4 h-[2.5px] bg-cyan/80 shadow-[0_0_12px_#00F2FE] rounded-full z-10"
              />
            )}

            <Fingerprint className={`h-11 w-11 transition-all duration-300 ${
              biometricScanning ? "text-cyan scale-110" : "text-ink-muted group-hover:text-cyan"
            }`} />
            
            {/* Spinning scanner circle outline */}
            <div className={`absolute inset-1.5 rounded-full border border-white/[0.04] transition-all duration-300 group-hover:border-cyan/20 ${
              biometricScanning ? "animate-spin border-t-cyan border-cyan/40" : ""
            }`} />
          </motion.button>

          <span className="mt-3.5 font-mono text-[10px] uppercase tracking-widest text-cyan font-bold flex items-center gap-1.5">
            {biometricScanning ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-cyan" />
                Analyzing Face & Print...
              </span>
            ) : (
              <span className="flex items-center gap-1 cursor-pointer" onClick={handleBiometricScan}>
                <Sparkles className="h-3 w-3 text-cyan animate-pulse" />
                Tap to Scan Biometrics
              </span>
            )}
          </span>
        </div>

        <div className="relative mb-6 flex items-center justify-center font-mono text-[9px] uppercase tracking-widest text-ink-faint">
          <div className="absolute inset-x-0 h-[1px] bg-white/[0.06]" />
          <span className="relative px-3 bg-[#08090d]">Or enter decryption key</span>
        </div>

        {/* Password Decryption Form */}
        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Decryption Password"
              className="pl-10 text-center font-mono border-white/[0.08] bg-[#050608]/90 focus-visible:ring-cyan/40"
              required
              autoFocus
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red/30 bg-red/10 px-3 py-2.5 text-left text-xs text-red">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={logout} 
              className="flex-1 text-ink-muted border-white/[0.08] hover:bg-white/[0.04]"
              disabled={checking || biometricScanning}
            >
              Log Out
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-cyan text-black hover:bg-cyan/90 font-semibold" 
              disabled={checking || biometricScanning}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-1.5" />
                  Decrypt
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="mt-6 font-mono text-[9px] text-ink-faint uppercase tracking-wider">
          Demo Decryption Password: <span className="text-cyan select-all">Test1234!</span>
        </p>
      </motion.div>
    </div>
  );
}
