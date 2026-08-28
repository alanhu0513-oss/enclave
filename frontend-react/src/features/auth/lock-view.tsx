import { useState } from "react";
import { motion } from "motion/react";
import { Lock, Unlock, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldMark } from "@/components/ui/logo";

export function LockView() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError("");
    try {
      await unlock(password);
    } catch (err: any) {
      setError(err?.message || "Incorrect password. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="vault-bg" />
      <div className="vault-grid" />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative w-full max-w-sm overflow-hidden rounded-2xl p-8 text-center shadow-2xl"
      >
        <div className="pulse-ring relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
          <ShieldMark size={34} />
        </div>
        <h1 className="font-display text-lg font-semibold text-ink">Vault Locked</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          Enter your password to continue
        </p>

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
              placeholder="Password"
              className="pl-10"
              required
              autoFocus
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-left text-xs text-red">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={checking}>
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            Unlock
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
