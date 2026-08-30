import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, LogIn, UserPlus, ShieldQuestion, ArrowLeft, Eye, EyeOff, Gift } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { getStoredReferralCode } from "@/lib/referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brand } from "@/components/ui/logo";
import { CyberBackground } from "@/components/psychology/cyber-background";

type Mode = "login" | "register" | "forgot";

export function AuthView() {
  const { login, register, loading } = useAuth();
  const { toast } = useApp();
  const [mode, setMode] = useState<Mode>(() =>
    getStoredReferralCode() ? "register" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login(email, password, rememberMe);
      } else if (mode === "register") {
        await register(email, password, fullName);
        toast({ title: "Account created", variant: "success" });
      } else {
        await api.forgotPassword(email);
        toast({
          title: "Reset link sent",
          body: "Check your email",
          variant: "info",
        });
        setMode("login");
      }
    } catch (err: any) {
      toast({ title: "Authentication error", body: err.message, variant: "error" });
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <CyberBackground />
      <div className="vault-bg" />
      <div className="vault-grid" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative z-10 w-full max-w-md overflow-hidden rounded-2xl p-8 shadow-2xl"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Brand className="mb-4" />
          <p className="text-sm text-ink-muted">
            {mode === "login"
              ? "Welcome back to the vault"
              : mode === "register"
              ? "Create your secure identity shield"
              : "Recover your account"}
          </p>
        </div>

        {getStoredReferralCode() && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 rounded-xl border border-green/25 bg-green/[0.06] p-3"
          >
            <Gift className="h-5 w-5 shrink-0 text-green" />
            <p className="text-xs text-ink">
              You were invited to ENCLAVE. Create your account to start protected — and your
              invite counts toward rewards.
            </p>
          </motion.div>
        )}

        {mode === "forgot" && (
          <button
            onClick={() => setMode("login")}
            className="mb-4 flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-cyan"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </button>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div>
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading} 
            size="lg"
            aria-label={mode === "login" ? "Unlock vault" : mode === "register" ? "Create account" : "Send reset link"}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : mode === "register" ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <ShieldQuestion className="h-4 w-4" />
            )}
            {mode === "login"
              ? "Unlock vault"
              : mode === "register"
              ? "Create account"
              : "Send reset link"}
          </Button>

          {mode !== "forgot" && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-white/12 bg-white/[0.03] text-green focus:ring-green"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs text-ink-muted transition-colors hover:text-cyan"
                aria-label="Forgot password"
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>

        <div className="mt-6 border-t border-white/[0.07] pt-5 text-center text-sm text-ink-muted">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => setMode("register")}
                className="font-medium text-green transition-colors hover:text-[#66ffc2]"
                aria-label="Sign up free"
              >
                Sign up free
              </button>
            </>
          ) : mode === "register" ? (
            <>
              Already protected?{" "}
              <button
                onClick={() => setMode("login")}
                className="font-medium text-green transition-colors hover:text-[#66ffc2]"
                aria-label="Sign in"
              >
                Sign in
              </button>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label 
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium text-ink-muted"
    >
      {children}
    </label>
  );
}
