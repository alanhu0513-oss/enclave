import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  IdCard,
  Shield,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Copy,
  RotateCcw,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SectionHeader, GradientCard, StatusBadge } from "@/components/ui/dashboard";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

interface Passport {
  id: string;
  holderName: string;
  verificationLevel: string;
  enrolledAt: string;
  expiresAt: string;
  status: string;
}

interface VerifyResult {
  valid: boolean;
  passport: Passport;
  message: string;
}

const VERIFICATION_LEVELS: Record<string, { label: string; color: string }> = {
  basic: { label: "Basic", color: "cyan" },
  verified: { label: "Verified", color: "green" },
  premium: { label: "Premium", color: "purple" },
};

export function PassportView() {
  const { toast } = useApp();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  // QR state
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Verify state
  const [verifyId, setVerifyId] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Revoke state
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function load() {
    try {
      const res = await api.getPassport();
      setPassport(res?.passport || null);
      setEnrolled(res?.enrolled || false);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleEnroll() {
    setEnrolling(true);
    try {
      const res = await api.enrollPassport();
      setPassport(res?.passport || null);
      setEnrolled(true);
      toast({ title: "Passport created", variant: "success" });
    } catch (e: any) {
      toast({ title: "Enrollment failed", body: e.message, variant: "error" });
    } finally {
      setEnrolling(false);
    }
  }

  async function handleGenerateQR() {
    setQrLoading(true);
    try {
      const res = await api.getPassportQR();
      setQrData(res?.qrData || null);
    } catch (e: any) {
      toast({ title: "QR generation failed", body: e.message, variant: "error" });
    } finally {
      setQrLoading(false);
    }
  }

  async function handleVerify() {
    if (!verifyId.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.verifyPassport(verifyId.trim());
      setVerifyResult(res as VerifyResult);
    } catch (e: any) {
      setVerifyResult({ valid: false, passport: null as any, message: e.message });
    } finally {
      setVerifying(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      await api.revokePassport();
      setPassport(null);
      setEnrolled(false);
      setShowRevokeConfirm(false);
      setQrData(null);
      toast({ title: "Passport revoked", variant: "success" });
    } catch (e: any) {
      toast({ title: "Revoke failed", body: e.message, variant: "error" });
    } finally {
      setRevoking(false);
    }
  }

  function copyPassportId() {
    if (passport?.id) {
      navigator.clipboard.writeText(passport.id);
      toast({ title: "Passport ID copied", variant: "success" });
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FadeIn>
        <SectionHeader
          icon={IdCard}
          title="Identity Passport"
          description="Your verified digital identity"
        />
      </FadeIn>

      {!enrolled ? (
        <FadeIn delay={0.1}>
          <GradientCard gradient="from-cyan/10 to-green/5">
            <CardContent className="flex flex-col items-center gap-6 py-12">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan/20 to-green/20 text-cyan"
              >
                <Shield className="h-10 w-10" />
              </motion.div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-ink">Create Your Passport</h2>
                <p className="mt-2 max-w-sm text-sm text-ink-muted">
                  Your Identity Passport is a verified digital credential that proves your identity across the Enclave network. It enables trusted interactions and premium features.
                </p>
              </div>
              <Button variant="cyan" size="lg" disabled={enrolling} onClick={handleEnroll}>
                {enrolling ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <IdCard className="h-5 w-5 mr-2" />
                )}
                {enrolling ? "Creating..." : "Create Your Passport"}
              </Button>
            </CardContent>
          </GradientCard>
        </FadeIn>
      ) : (
        <div className="space-y-6">
          {/* Passport Card */}
          <FadeIn delay={0.1}>
            <Kinetic>
              <Card className="relative overflow-hidden border-cyan/20">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-green/5" />
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan/[0.04] blur-3xl" />
                <CardContent className="relative pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan/20 to-green/20 text-cyan">
                        <IdCard className="h-7 w-7" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-ink">{passport?.holderName}</h2>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={(VERIFICATION_LEVELS[passport?.verificationLevel || "basic"]?.color as any) || "cyan"}>
                            <ShieldCheck className="h-3 w-3 mr-0.5" />
                            {VERIFICATION_LEVELS[passport?.verificationLevel || "basic"]?.label || passport?.verificationLevel}
                          </Badge>
                          <StatusBadge status={passport?.status || "active"} />
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="iconSm" onClick={copyPassportId} title="Copy Passport ID">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Passport ID</p>
                      <p className="mt-1 font-mono text-sm text-ink truncate">{passport?.id}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Enrolled</p>
                      <p className="mt-1 text-sm text-ink">
                        {passport?.enrolledAt ? new Date(passport.enrolledAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Expires</p>
                      <p className="mt-1 text-sm text-ink">
                        {passport?.expiresAt ? new Date(passport.expiresAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Kinetic>
          </FadeIn>

          {/* Actions Row */}
          <StaggerContainer className="grid gap-4 sm:grid-cols-2">
            {/* QR Code Section */}
            <StaggerItem>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <QrCode className="h-5 w-5 text-cyan" />
                    QR Verification
                  </CardTitle>
                  <CardDescription>Generate a QR code for quick verification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {qrData ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-white/[0.06] bg-white p-2">
                        <img
                          src={`data:image/png;base64,${qrData}`}
                          alt="Passport QR Code"
                          className="h-full w-full"
                        />
                      </div>
                      <p className="text-xs text-ink-muted">Expires in 5 minutes</p>
                      <Button variant="ghost" size="sm" onClick={handleGenerateQR} disabled={qrLoading}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Refresh
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/[0.04] text-ink-faint">
                        <QrCode className="h-10 w-10" />
                      </div>
                      <Button variant="outline" onClick={handleGenerateQR} disabled={qrLoading}>
                        {qrLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <QrCode className="h-4 w-4 mr-2" />
                        )}
                        {qrLoading ? "Generating..." : "Generate QR Code"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Verify Section */}
            <StaggerItem>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-5 w-5 text-green" />
                    Verify Passport
                  </CardTitle>
                  <CardDescription>Check the validity of a passport</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter passport ID..."
                      value={verifyId}
                      onChange={(e) => setVerifyId(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                    />
                    <Button
                      variant="default"
                      disabled={!verifyId.trim() || verifying}
                      onClick={handleVerify}
                    >
                      {verifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>

                  {verifyResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4",
                        verifyResult.valid
                          ? "border-green/30 bg-green/[0.05]"
                          : "border-red/30 bg-red/[0.05]"
                      )}
                    >
                      {verifyResult.valid ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red" />
                      )}
                      <div>
                        <p className={cn("text-sm font-medium", verifyResult.valid ? "text-green" : "text-red")}>
                          {verifyResult.valid ? "Valid Passport" : "Invalid Passport"}
                        </p>
                        <p className="mt-1 text-xs text-ink-muted">{verifyResult.message}</p>
                        {verifyResult.valid && verifyResult.passport && (
                          <div className="mt-2 space-y-1 text-xs text-ink-muted">
                            <p>Holder: <span className="text-ink">{verifyResult.passport.holderName}</span></p>
                            <p>Level: <span className="text-ink">{verifyResult.passport.verificationLevel}</span></p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          </StaggerContainer>

          {/* Revoke Section */}
          <FadeIn delay={0.25}>
            <Card className="border-red/20 bg-red/[0.02]">
              <CardContent className="flex items-center justify-between pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red" />
                  <div>
                    <p className="text-sm font-medium text-ink">Revoke Passport</p>
                    <p className="text-xs text-ink-muted">Permanently invalidate your identity passport</p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowRevokeConfirm(true)}
                >
                  Revoke
                </Button>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Revoke Confirmation Dialog */}
          {showRevokeConfirm && (
            <FadeIn>
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/15 text-red">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-ink">Revoke Passport?</h3>
                  </div>
                  <p className="text-sm text-ink-muted mb-6">
                    This action cannot be undone. Your passport will be permanently invalidated and you will need to create a new one.
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => setShowRevokeConfirm(false)}
                      disabled={revoking}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleRevoke}
                      disabled={revoking}
                    >
                      {revoking ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      {revoking ? "Revoking..." : "Revoke Passport"}
                    </Button>
                  </div>
                </motion.div>
              </div>
            </FadeIn>
          )}
        </div>
      )}
    </div>
  );
}
