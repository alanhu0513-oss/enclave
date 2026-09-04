import { useState } from "react";
import { motion } from "motion/react";
import {
  Shield,
  KeyRound,
  Smartphone,
  LogIn,
  Loader2,
  CheckCircle2,
  Mail,
  Lock,
  Fingerprint,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

/* ─── Security Panel ───
 * Password change, 2FA, email verification, login history.
 */
export function SecurityPanel() {
  const { toast } = useApp();
  const [tab, setTab] = useState<"password" | "2fa" | "history">("password");

  return (
    <Card className="relative overflow-hidden border-white/[0.06]">
      <div className="absolute inset-0 bg-gradient-to-br from-green/5 to-transparent" />
      <div className="relative">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/15 text-green">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Security</CardTitle>
              <CardDescription>Password, two-factor auth & activity</CardDescription>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {(["password", "2fa", "history"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  tab === t
                    ? "bg-green/15 text-green"
                    : "text-ink-muted hover:bg-white/[0.03] hover:text-ink"
                }`}
              >
                {t === "password" ? "Password" : t === "2fa" ? "2FA" : "Login history"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {tab === "password" && <PasswordSection />}
          {tab === "2fa" && <TwoFASection />}
          {tab === "history" && <HistorySection />}
        </CardContent>
      </div>
    </Card>
  );
}

/* ─── Password Section ─── */
function PasswordSection() {
  const { toast } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [codeStep, setCodeStep] = useState<"initial" | "sendCode" | "enterCode">("initial");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  async function sendCode() {
    if (!current) {
      toast({ title: "Enter current password", variant: "error" });
      return;
    }
    setSending(true);
    try {
      await api.sendVerification("change-password");
      setCodeStep("enterCode");
      toast({ title: "Verification code sent to your email", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to send code", body: e.message, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  async function changePassword() {
    if (!current || !next || !confirm) {
      toast({ title: "All fields required", variant: "error" });
      return;
    }
    if (next !== confirm) {
      toast({ title: "Passwords don't match", variant: "error" });
      return;
    }
    if (next.length < 8) {
      toast({ title: "Password must be 8+ characters", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setCode("");
      setCodeStep("initial");
      toast({ title: "Password changed", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to change password", body: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Current password</label>
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Enter current password"
          />
        </div>
        {codeStep === "enterCode" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Verification code
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code from email"
                maxLength={6}
              />
            </div>
            <Button variant="outline" size="sm" onClick={sendCode} disabled={sending}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Resend"}
            </Button>
          </motion.div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">New password</label>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="New password"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Confirm</label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
        </div>
      </div>
      {codeStep === "initial" ? (
        <Button
          variant="default"
          onClick={sendCode}
          disabled={sending || !current}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Send verification code
        </Button>
      ) : (
        <Button
          variant="default"
          onClick={changePassword}
          disabled={saving || !code || !next || !confirm}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Change password
        </Button>
      )}
    </div>
  );
}

/* ─── 2FA Section ─── */
function TwoFASection() {
  const { toast } = useApp();
  const [status, setStatus] = useState<{ enabled: boolean; hasSecret: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const s = await api.get2FAStatus();
      setStatus(s);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function startSetup() {
    setBusy(true);
    try {
      const s = await api.setup2FA();
      setSetup({ secret: s.secret, qrCode: s.qrCode });
    } catch (e: any) {
      toast({ title: "Setup failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function verifySetup() {
    setBusy(true);
    try {
      await api.verify2FA(token);
      setSetup(null);
      setToken("");
      toast({ title: "2FA enabled", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Invalid code", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await api.disable2FA(token, password);
      setToken("");
      setPassword("");
      toast({ title: "2FA disabled", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-green" />
      </div>
    );
  }

  if (setup) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 rounded-xl bg-white/[0.03] p-6">
          <img src={setup.qrCode} alt="2FA QR code" className="h-40 w-40 rounded-lg" />
          <p className="text-xs text-ink-muted">
            Scan with Google Authenticator, then enter the 6-digit code
          </p>
          <div className="w-full max-w-xs">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
              Backup code
            </p>
            <code className="block rounded-lg bg-black/40 px-3 py-2 text-center text-xs text-green">
              {setup.secret}
            </code>
          </div>
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="6-digit code"
            maxLength={6}
            className="max-w-xs text-center"
          />
          <Button variant="default" onClick={verifySetup} disabled={busy || token.length < 6}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Verify & enable
          </Button>
        </div>
      </div>
    );
  }

  if (status?.enabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-green/[0.06] p-4">
          <CheckCircle2 className="h-5 w-5 text-green" />
          <div>
            <p className="text-sm font-medium text-ink">Two-factor authentication is on</p>
            <p className="text-xs text-ink-muted">You'll need a code from your authenticator app to sign in.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Authenticator code</label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="6-digit code" maxLength={6} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Your password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="To confirm" />
          </div>
        </div>
        <Button variant="outline" onClick={disable} disabled={busy || !token || !password}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          Disable 2FA
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Add an extra layer of security. Enable two-factor authentication (2FA) with an authenticator app.
      </p>
      <Button variant="default" onClick={startSetup} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
        Set up 2FA
      </Button>
    </div>
  );
}

/* ─── Login History Section ─── */
function HistorySection() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const l = await api.getLoginHistory();
        setLogs(Array.isArray(l) ? l : []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-green" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-ink-faint">
        <LogIn className="h-3.5 w-3.5" />
        Recent sign-ins to your account
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-ink-muted">No sign-ins recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  log.success ? "bg-green/15 text-green" : "bg-red/15 text-red"
                }`}
              >
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink">
                  {log.success ? "Successful sign-in" : "Failed attempt"}
                </p>
                <p className="text-[11px] text-ink-muted truncate">
                  {log.ip_address || "Unknown IP"}
                  {log.user_agent ? ` · ${log.user_agent.slice(0, 60)}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-ink-faint">
                {log.created_at ? timeAgo(log.created_at) : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
