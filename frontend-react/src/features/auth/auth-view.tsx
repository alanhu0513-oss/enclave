import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, LogIn, UserPlus, ShieldQuestion, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brand } from "@/components/ui/logo";

type Mode = "login" | "register" | "forgot";

export function AuthView() {
  const { login, register, loading } = useAuth();
  const { toast } = useApp();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login(email, password);
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
      <div className="vault-bg" />
      <div className="vault-grid" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative w-full max-w-md overflow-hidden rounded-2xl p-8 shadow-2xl"
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
              <Label>Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>
          )}
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading} size="lg">
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
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="w-full text-center text-xs text-ink-muted transition-colors hover:text-cyan"
            >
              Forgot password?
            </button>
          )}
        </form>

        <div className="mt-6 border-t border-white/[0.07] pt-5 text-center text-sm text-ink-muted">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => setMode("register")}
                className="font-medium text-green transition-colors hover:text-[#66ffc2]"
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-ink-muted">
      {children}
    </label>
  );
}
