import { useState } from "react";
import { motion } from "motion/react";
import {
  UserRound,
  Mail,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/* ─── Account Panel ───
 * Profile, email verification, change email, delete account.
 */
export function AccountPanel() {
  const { user, setUser } = useAuth();
  const { toast } = useApp();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [saving, setSaving] = useState(false);
  const [emailStep, setEmailStep] = useState<"none" | "verifyCurrent" | "enterNew" | "verifyNew">("none");
  const [currentCode, setCurrentCode] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCode, setNewCode] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteView, setDeleteView] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delCode, setDelCode] = useState("");
  const [delStep, setDelStep] = useState<"confirm" | "enterCode">("confirm");
  const emailVerified = !!(user as any)?.emailVerified;
  const [verifyStep, setVerifyStep] = useState<"none" | "enterCode">("none");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function sendVerify() {
    setSending(true);
    try {
      await api.sendVerification("general");
      setVerifyStep("enterCode");
      toast({ title: "Verification code sent to " + user?.email, variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  async function confirmVerify() {
    setVerifying(true);
    try {
      await api.verifyEmail(verifyCode, "general");
      setUser({ ...user, emailVerified: true });
      setVerifyStep("none");
      setVerifyCode("");
      toast({ title: "Email verified", variant: "success" });
    } catch (e: any) {
      toast({ title: "Invalid code", body: e.message, variant: "error" });
    } finally {
      setVerifying(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await api.updateProfile(fullName);
      setUser({ ...user, fullName });
      toast({ title: "Profile updated", variant: "success" });
    } catch (e: any) {
      toast({ title: "Update failed", body: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function sendCurrentVerify() {
    setSending(true);
    try {
      await api.sendVerification("change-email");
      setEmailStep("verifyCurrent");
      toast({ title: "Code sent to " + user?.email, variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  async function verifyCurrent() {
    setSending(true);
    try {
      await api.verifyEmail(currentCode, "change-email");
      setCurrentCode("");
      setEmailStep("enterNew");
      toast({ title: "Email verified. Enter new email.", variant: "success" });
    } catch (e: any) {
      toast({ title: "Invalid code", body: e.message, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  async function sendNewVerify() {
    setSending(true);
    try {
      await api.sendVerification("change-email");
      setEmailStep("verifyNew");
      toast({ title: "Code sent to " + newEmail, variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  async function completeChange() {
    setSaving(true);
    try {
      await api.changeEmail(newEmail, newCode);
      setNewEmail("");
      setNewCode("");
      setEmailStep("none");
      toast({ title: "Email changed", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function sendDeleteCode() {
    setSending(true);
    try {
      await api.sendVerification("delete-account");
      setDelStep("enterCode");
      toast({ title: "Verification code sent", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  async function confirmDelete() {
    setSaving(true);
    try {
      await api.deleteAccount(delPassword, delCode);
      toast({ title: "Account deleted", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="relative overflow-hidden border-white/[0.06]">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 to-transparent" />
      <div className="relative">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>Profile, email & account management</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Profile */}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Full name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Email</label>
                <Input
                  value={user?.email || ""}
                  disabled
                  className="pr-16"
                />
                <Badge
                  variant={emailVerified ? "green" : "amber"}
                  className="absolute right-8 mt-[-28px] text-[10px]"
                >
                  {emailVerified ? "Verified" : "Unverified"}
                </Badge>
              </div>
            </div>
            {!emailVerified && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {verifyStep === "none" ? (
                  <Button variant="outline" size="sm" onClick={sendVerify} disabled={sending}>
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    Verify email
                  </Button>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                        Code sent to {user?.email}
                      </label>
                      <Input
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value)}
                        placeholder="6-digit code"
                        maxLength={6}
                      />
                    </div>
                    <Button size="sm" variant="default" onClick={confirmVerify} disabled={verifying || verifyCode.length < 6}>
                      {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Verify
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
            <Button onClick={saveProfile} disabled={saving || fullName === user?.fullName}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>

          <div className="my-4 h-px bg-white/[0.06]" />

          {/* Change email */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-cyan" />
              <h4 className="text-sm font-semibold text-ink">Change email</h4>
            </div>
            {emailStep === "none" && (
              <Button variant="outline" size="sm" onClick={sendCurrentVerify} disabled={sending}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Verify current email
              </Button>
            )}
            {emailStep === "verifyCurrent" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">Code from current email</label>
                  <Input
                    value={currentCode}
                    onChange={(e) => setCurrentCode(e.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                  />
                </div>
                <Button size="sm" variant="default" onClick={verifyCurrent} disabled={sending || currentCode.length < 6}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Verify
                </Button>
              </motion.div>
            )}
            {emailStep === "enterNew" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">New email address</label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@email.com"
                  />
                </div>
                <Button size="sm" variant="default" onClick={sendNewVerify} disabled={sending || !newEmail}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send code"}
                </Button>
              </motion.div>
            )}
            {emailStep === "verifyNew" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">Code from new email</label>
                  <Input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                  />
                </div>
                <Button size="sm" variant="default" onClick={completeChange} disabled={saving || newCode.length < 6}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                </Button>
              </motion.div>
            )}
          </div>

          <div className="my-4 h-px bg-white/[0.06]" />

          {/* Delete account */}
          <div className="rounded-xl border border-red/20 bg-red/[0.04] p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red" />
              <h4 className="text-sm font-semibold text-red">Delete account</h4>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Permanently delete your account and all associated data.
            </p>
            {!deleteView ? (
              <Button size="sm" variant="outline" className="mt-3 border-red/30 text-red hover:bg-red/10" onClick={() => setDeleteView(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete my account
              </Button>
            ) : (
              <div className="mt-3 space-y-3">
                {delStep === "confirm" ? (
                  <>
                    <Input
                      type="password"
                      value={delPassword}
                      onChange={(e) => setDelPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="max-w-sm"
                    />
                    <Button size="sm" variant="outline" className="border-red/30 text-red" onClick={sendDeleteCode} disabled={sending || !delPassword}>
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Send verification code
                    </Button>
                  </>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-medium text-ink-muted">Verification code</label>
                      <Input
                        value={delCode}
                        onChange={(e) => setDelCode(e.target.value)}
                        placeholder="6-digit code"
                        maxLength={6}
                      />
                    </div>
                    <Button size="sm" variant="outline" className="border-red/30 text-red" onClick={confirmDelete} disabled={saving || delCode.length < 6}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Confirm delete
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
