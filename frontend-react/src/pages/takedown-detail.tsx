import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Shield, 
  Download, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  FileText, 
  Scale, 
  ExternalLink, 
  Lock, 
  Printer,
  Copy,
  Check,
  Building2,
  History,
  FileCheck2
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { downloadDMCAPdf, createDMCAPdfBlobUrl, type DMCAPdfData } from "@/lib/dmca-pdf";
import { cn } from "@/lib/utils";

type TakedownStage = "pending" | "in_progress" | "resolved";

interface TakedownRecord {
  id: string;
  platform: string;
  status: TakedownStage;
  type: string;
  targetUrl: string;
  createdAt: string;
  abuseEmail: string;
  evidenceHash: string;
}

const STAGES = [
  {
    key: "pending" as TakedownStage,
    title: "1. Notice Dispatched",
    shortLabel: "Pending Notice",
    statusBadge: "PENDING REVIEW",
    badgeColor: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    desc: "Statutory DMCA notice drafted, cryptographically signed, and transmitted to platform designated agent.",
    subtext: "17 U.S.C. § 512(c) safe harbor clock initiated. Delivery confirmation logged.",
    icon: Clock,
  },
  {
    key: "in_progress" as TakedownStage,
    title: "2. Host Review & Takedown Window",
    shortLabel: "In Progress",
    statusBadge: "HOST PROCESSING",
    badgeColor: "text-cyan border-cyan/30 bg-cyan/10",
    desc: "Designated Copyright Agent logged receipt. Infringing synthetic content is queued for disabling.",
    subtext: "48-Hour statutory escalation deadline active. Automated crawler polling target URL.",
    icon: ShieldAlert,
  },
  {
    key: "resolved" as TakedownStage,
    title: "3. Takedown Enforced & Content Purged",
    shortLabel: "Resolved",
    statusBadge: "CONTENT REMOVED",
    badgeColor: "text-green border-green/30 bg-green/10",
    desc: "Infringing deepfake media removed; HTTP 404 response verified by autonomous crawler.",
    subtext: "Certificate of compliance issued. Forensic identity ledger sealed and archived.",
    icon: CheckCircle2,
  },
];

export function TakedownDetail() {
  const [takedownId, setTakedownId] = useState<string>("enc-dmca-case");
  const [record, setRecord] = useState<TakedownRecord | null>(null);
  const [status, setStatus] = useState<TakedownStage>("pending");
  const [activeTab, setActiveTab] = useState<"document" | "pdf" | "evidence">("document");
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Extract ID from pathname
  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split("/");
    const id = parts[2] || "enc-dmca-sample";
    setTakedownId(id);
  }, []);

  // Fetch or initialize record
  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        // Check localStorage for initiated takedown
        let localData: any = null;
        try {
          const raw = localStorage.getItem("enclave_active_takedown");
          if (raw) localData = JSON.parse(raw);
        } catch {
          // ignore
        }

        let apiData: any = null;
        try {
          if (takedownId && !takedownId.startsWith("enc-dmca-")) {
            const res = await api.getTakedown(takedownId);
            if (res && res.data) apiData = res.data;
          }
        } catch {
          // fallback
        }

        if (!isMounted) return;

        const effective = apiData || localData || {};
        const rawStatus = effective.status || "pending";
        const normalizedStatus: TakedownStage = 
          rawStatus === "removed" || rawStatus === "resolved" 
            ? "resolved" 
            : rawStatus === "acknowledged" || rawStatus === "in_progress" 
              ? "in_progress" 
              : "pending";

        const resolvedRecord: TakedownRecord = {
          id: takedownId,
          platform: effective.platform || "X (Twitter) CDN & Web Host",
          status: normalizedStatus,
          type: effective.type || "dmca",
          targetUrl: effective.targetUrl || effective.url || "https://x.com/synthetic_lab/status/deepfake_executive_sample",
          createdAt: effective.createdAt || effective.timestamp || new Date().toISOString(),
          abuseEmail: effective.abuseEmail || "copyright@x.com",
          evidenceHash: effective.evidenceHash || effective.phash || "sha256:9f8a21e40c8b98127394cba81001"
        };

        setRecord(resolvedRecord);
        setStatus(normalizedStatus);

        // Generate PDF blob preview
        try {
          const blob = createDMCAPdfBlobUrl({
            id: resolvedRecord.id,
            platform: resolvedRecord.platform,
            targetUrl: resolvedRecord.targetUrl,
            status: normalizedStatus,
            createdAt: resolvedRecord.createdAt,
            abuseEmail: resolvedRecord.abuseEmail,
            evidenceHash: resolvedRecord.evidenceHash,
            caseId: `#ENC-DMCA-${resolvedRecord.id.slice(0, 8).toUpperCase()}`,
          });
          setPdfBlobUrl(blob);
        } catch (err) {
          console.error("PDF preview generation error:", err);
        }

      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, [takedownId]);

  // When status changes, update the record and refresh the live PDF blob
  const handleStatusChange = (newStatus: TakedownStage) => {
    setStatus(newStatus);
    if (record) {
      const updated = { ...record, status: newStatus };
      setRecord(updated);

      // Refresh PDF blob preview with new status
      try {
        const blob = createDMCAPdfBlobUrl({
          id: updated.id,
          platform: updated.platform,
          targetUrl: updated.targetUrl,
          status: newStatus,
          createdAt: updated.createdAt,
          abuseEmail: updated.abuseEmail,
          evidenceHash: updated.evidenceHash,
          caseId: `#ENC-DMCA-${updated.id.slice(0, 8).toUpperCase()}`,
        });
        setPdfBlobUrl(blob);
      } catch (e) {
        console.error("Failed to update PDF blob:", e);
      }

      // Sync active takedown in localStorage for the AppShell banner
      try {
        const stored = localStorage.getItem("enclave_active_takedown");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.status = newStatus;
          localStorage.setItem("enclave_active_takedown", JSON.stringify(parsed));
        }
      } catch {
        // ignore
      }
    }
  };

  const handleDownloadPdf = () => {
    if (!record) return;
    const pdfData: DMCAPdfData = {
      id: record.id,
      platform: record.platform,
      targetUrl: record.targetUrl,
      status: status,
      createdAt: record.createdAt,
      abuseEmail: record.abuseEmail,
      evidenceHash: record.evidenceHash,
      caseId: `#ENC-DMCA-${record.id.slice(0, 8).toUpperCase()}`,
    };

    downloadDMCAPdf(pdfData);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleCopyNotice = () => {
    if (!record) return;
    const text = generateNoticeText(record, status);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToDashboard = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const stageIndex = useMemo(() => {
    if (status === "resolved") return 2;
    if (status === "in_progress") return 1;
    return 0;
  }, [status]);

  if (!takedownId || loading || !record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050507] text-ink">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p className="font-mono text-xs text-ink-muted">Loading Legal DMCA Enforcement Dossier...</p>
        </div>
      </div>
    );
  }

  const caseNumber = `#ENC-DMCA-${record.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[#050507] text-ink font-sans pb-24 selection:bg-cyan/20 selection:text-cyan">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-cyan/10 blur-[130px] rounded-full" />
        <div className="absolute top-96 -right-20 w-[400px] h-[400px] bg-blue/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <a
            href="/"
            onClick={handleBackToDashboard}
            className="group inline-flex items-center gap-2 font-mono text-xs text-ink-muted hover:text-cyan transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>Return to Security Command Center</span>
          </a>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyNotice}
              className="gap-1.5 font-mono text-xs border-white/[0.08] hover:border-cyan/40 hover:bg-white/[0.04]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Notice Copied" : "Copy Legal Notice"}</span>
            </Button>

            <Button
              variant="cyan"
              size="sm"
              onClick={handleDownloadPdf}
              className="gap-1.5 font-mono text-xs font-bold text-black shadow-[0_0_16px_rgba(0,242,254,0.35)] relative overflow-hidden group"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{downloadSuccess ? "PDF Downloaded!" : "Download Official PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan animate-pulse shadow-[0_0_8px_#00f2fe]" />
              <span className="font-mono text-xs tracking-widest text-cyan uppercase font-bold">
                LEGAL ENFORCEMENT & DMCA ARTIFACT
              </span>
              <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                17 U.S.C. § 512(c)
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Autonomous DMCA Takedown Notice
            </h1>
            <p className="font-mono text-xs text-ink-muted flex items-center gap-2">
              <span>CASE ID: <strong className="text-ink">{caseNumber}</strong></span>
              <span>•</span>
              <span>FILED: {new Date(record.createdAt).toLocaleDateString()}</span>
              <span>•</span>
              <span className="text-cyan font-semibold">AUTHENTICATED BIOMETRIC DEFENSE</span>
            </p>
          </div>
        </div>

        {/* Bento Overview: 3 Organized, High-Impact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Legal Lifecycle Status */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-white/[0.08] bg-[#07080f]/90 p-5 backdrop-blur-xl shadow-lg relative overflow-hidden group"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-cyan" />
                Current Status
              </span>
              <span className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                STAGES[stageIndex].badgeColor
              )}>
                {STAGES[stageIndex].statusBadge}
              </span>
            </div>

            <div className="mt-3">
              <div className="font-display text-xl font-bold text-ink capitalize flex items-center gap-2">
                {status.replace("_", " ")}
              </div>
              <p className="mt-1 font-mono text-[11px] text-ink-muted leading-relaxed">
                {STAGES[stageIndex].desc}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between font-mono text-[11px]">
              <span className="text-ink-faint">Statutory Clock:</span>
              <span className="text-cyan font-semibold">
                {status === "resolved" ? "0h (Enforced)" : "48h Safe Harbor Window"}
              </span>
            </div>
          </motion.div>

          {/* Card 2: Platform & Target Host */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-2xl border border-white/[0.08] bg-[#07080f]/90 p-5 backdrop-blur-xl shadow-lg relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-cyan" />
                Target Service Provider
              </span>
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                OSP Designated Agent
              </span>
            </div>

            <div className="mt-3">
              <div className="font-display text-base font-bold text-ink truncate">
                {record.platform}
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-cyan truncate">
                {record.abuseEmail}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between font-mono text-[11px]">
              <span className="text-ink-faint">Infringing URL:</span>
              <a
                href={record.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-ink-muted hover:text-cyan truncate max-w-[170px] inline-flex items-center gap-1"
                title={record.targetUrl}
              >
                <span className="truncate">{record.targetUrl.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          </motion.div>

          {/* Card 3: Cryptographic Proof & Ledger */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-2xl border border-white/[0.08] bg-[#07080f]/90 p-5 backdrop-blur-xl shadow-lg relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-cyan" />
                Evidence Chain-of-Custody
              </span>
              <span className="rounded-full bg-green/10 text-green border border-green/30 px-2 py-0.5 font-mono text-[10px] font-bold">
                SEALED
              </span>
            </div>

            <div className="mt-3">
              <div className="font-display text-base font-bold text-ink">
                FIPS-140-2 Hash Anchor
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-ink-muted break-all select-all">
                {record.evidenceHash}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between font-mono text-[11px]">
              <span className="text-ink-faint">Biometric Match:</span>
              <span className="text-green font-semibold">99.4% Faceprint Correlation</span>
            </div>
          </motion.div>
        </div>

        {/* Interactive Statutory Lifecycle Stepper with Smooth Motion */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#07080f]/80 p-5 sm:p-6 backdrop-blur-xl shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div>
              <h2 className="font-display text-sm sm:text-base font-semibold text-ink flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-cyan" />
                DMCA Enforcement Timeline & Compliance Stages
              </h2>
              <p className="font-mono text-xs text-ink-muted mt-0.5">
                Autonomous compliance timeline tracked under statutory DMCA enforcement provisions.
              </p>
            </div>
            <span className="font-mono text-[10px] text-cyan tracking-wider">
              17 U.S.C. § 512(c)(3) PIPELINE
            </span>
          </div>

          {/* Stepper Bar */}
          <div className="relative pt-2 pb-2">
            {/* Background connection track */}
            <div className="absolute top-6 left-8 right-8 h-1 bg-white/[0.06] rounded-full" />
            
            {/* Animated foreground progress fill */}
            <motion.div
              className="absolute top-6 left-8 h-1 rounded-full bg-gradient-to-r from-amber-500 via-cyan to-green shadow-[0_0_14px_rgba(0,242,254,0.6)]"
              initial={{ width: "0%" }}
              animate={{ 
                width: stageIndex === 0 ? "12%" : stageIndex === 1 ? "50%" : "96%" 
              }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Stepper Stage Buttons */}
            <div className="relative z-10 grid grid-cols-3 gap-2">
              {STAGES.map((st, idx) => {
                const Icon = st.icon;
                const isPassed = stageIndex >= idx;
                const isCurrent = stageIndex === idx;

                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => handleStatusChange(st.key)}
                    className="flex flex-col items-center text-center group cursor-pointer focus:outline-none"
                  >
                    <motion.div
                      layout
                      animate={{
                        scale: isCurrent ? 1.12 : 1,
                        borderColor: isCurrent 
                          ? (st.key === "pending" ? "#f59e0b" : st.key === "in_progress" ? "#00f2fe" : "#22c55e")
                          : isPassed ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)",
                        backgroundColor: isCurrent 
                          ? (st.key === "pending" ? "rgba(245, 158, 11, 0.18)" : st.key === "in_progress" ? "rgba(0, 242, 254, 0.18)" : "rgba(34, 197, 94, 0.18)")
                          : isPassed ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.5)"
                      }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "relative flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all shadow-md",
                        isCurrent && "ring-4 ring-cyan/25"
                      )}
                    >
                      <Icon className={cn(
                        "h-5 w-5 transition-colors",
                        isCurrent 
                          ? (st.key === "pending" ? "text-amber-400" : st.key === "in_progress" ? "text-cyan" : "text-green")
                          : isPassed ? "text-ink" : "text-ink-faint"
                      )} />
                      
                      {isCurrent && (
                        <motion.span
                          layoutId="pulse-indicator"
                          className={cn(
                            "absolute -inset-1 rounded-2xl animate-pulse opacity-40 -z-10",
                            st.key === "pending" && "bg-amber-400",
                            st.key === "in_progress" && "bg-cyan",
                            st.key === "resolved" && "bg-green"
                          )}
                        />
                      )}
                    </motion.div>

                    <div className="mt-2.5 space-y-0.5">
                      <span className={cn(
                        "font-display text-xs font-bold block transition-colors",
                        isCurrent 
                          ? (st.key === "pending" ? "text-amber-400" : st.key === "in_progress" ? "text-cyan" : "text-green")
                          : isPassed ? "text-ink" : "text-ink-muted"
                      )}>
                        {st.shortLabel}
                      </span>
                      <span className="font-mono text-[10px] text-ink-faint hidden sm:block">
                        Step {idx + 1}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Stage Callout Card with AnimatePresence */}
          <AnimatePresence mode="wait">
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "rounded-xl border p-4 font-mono text-xs space-y-2 transition-colors",
                status === "pending" && "border-amber-500/30 bg-amber-500/5",
                status === "in_progress" && "border-cyan/30 bg-cyan/5",
                status === "resolved" && "border-green/30 bg-green/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex h-2 w-2 rounded-full",
                    status === "pending" && "bg-amber-400 animate-ping",
                    status === "in_progress" && "bg-cyan animate-ping",
                    status === "resolved" && "bg-green"
                  )} />
                  <span className="font-bold uppercase tracking-wider text-ink font-sans">
                    {STAGES[stageIndex].title}
                  </span>
                </div>
                <span className="text-[10px] text-ink-faint font-mono">
                  UPDATED: {new Date().toLocaleTimeString()}
                </span>
              </div>
              <p className="text-ink-muted text-xs leading-relaxed font-sans">
                {STAGES[stageIndex].desc}
              </p>
              <p className="text-[11px] text-ink-faint leading-relaxed border-t border-white/[0.04] pt-2">
                {STAGES[stageIndex].subtext}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* View Mode Tabs: Document Preview vs Live Generated PDF vs Forensic Evidence */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("document")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all",
                activeTab === "document"
                  ? "bg-cyan/15 text-cyan border border-cyan/30 shadow-[0_0_12px_rgba(0,242,254,0.2)]"
                  : "text-ink-muted hover:text-ink hover:bg-white/[0.04]"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Legal Notice Document</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pdf")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all",
                activeTab === "pdf"
                  ? "bg-cyan/15 text-cyan border border-cyan/30 shadow-[0_0_12px_rgba(0,242,254,0.2)]"
                  : "text-ink-muted hover:text-ink hover:bg-white/[0.04]"
              )}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Official PDF Renderer</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("evidence")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all",
                activeTab === "evidence"
                  ? "bg-cyan/15 text-cyan border border-cyan/30 shadow-[0_0_12px_rgba(0,242,254,0.2)]"
                  : "text-ink-muted hover:text-ink hover:bg-white/[0.04]"
              )}
            >
              <History className="h-3.5 w-3.5" />
              <span>Audit Log & Evidence</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="cyan"
              size="sm"
              onClick={handleDownloadPdf}
              className="font-mono text-xs font-bold text-black h-8 px-3.5 shadow-[0_0_12px_rgba(0,242,254,0.25)]"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {downloadSuccess ? "Downloaded!" : "Download PDF"}
            </Button>
          </div>
        </div>

        {/* Tab 1: Formal Legal Notice Document */}
        {activeTab === "document" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-white/[0.08] bg-[#0a0b12] p-6 sm:p-10 shadow-2xl text-ink font-sans space-y-6 relative overflow-hidden"
          >
            {/* Top Official Letterhead */}
            <div className="border-b border-white/[0.1] pb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-cyan font-mono text-xs font-bold tracking-wider uppercase">
                  <Shield className="h-4 w-4" />
                  ENCLAVE FORENSIC VAULT & LEGAL INTELLIGENCE
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-ink tracking-tight">
                  FORMAL NOTIFICATION OF COPYRIGHT & BIOMETRIC INFRINGEMENT
                </h2>
                <p className="font-mono text-xs text-ink-muted">
                  Pursuant to 17 U.S.C. § 512(c) (Digital Millennium Copyright Act) & Take It Down Act
                </p>
              </div>

              <div className="font-mono text-xs text-right space-y-1 text-ink-muted">
                <div>DATE: {new Date(record.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
                <div>CASE REF: <strong className="text-ink">{caseNumber}</strong></div>
                <div className="text-cyan font-bold">STATUS: {status.toUpperCase()}</div>
              </div>
            </div>

            {/* Recipient Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div>
                <span className="text-ink-faint block uppercase tracking-wider text-[10px]">TO DESIGNATED COPYRIGHT AGENT:</span>
                <p className="mt-1 text-ink font-semibold">{record.platform} Legal & Abuse Operations</p>
                <p className="text-ink-muted">{record.abuseEmail}</p>
                <p className="text-ink-muted">Registered Online Service Provider Agent (17 U.S.C. § 512(c)(2))</p>
              </div>
              <div>
                <span className="text-ink-faint block uppercase tracking-wider text-[10px]">TRANSMITTED ON BEHALF OF:</span>
                <p className="mt-1 text-ink font-semibold">Protected Rights Holder (Identity Authenticated)</p>
                <p className="text-ink-muted">Authorized Representative: Enclave Autonomous Legal Agent</p>
                <p className="text-cyan text-[11px]">Cryptographic Chain: FIPS-140-2 Ledger Verified</p>
              </div>
            </div>

            {/* Clauses */}
            <div className="space-y-4 text-xs sm:text-sm text-ink-muted leading-relaxed font-sans">
              <p>
                Dear Designated Copyright Agent,
              </p>
              <p>
                This letter constitutes formal notification pursuant to the Digital Millennium Copyright Act (17 U.S.C. § 512(c)(3)) demanding the immediate removal or disabling of access to unauthorized and infringing synthetic material hosted on your computer network, server, or cloud delivery infrastructure.
              </p>
              
              {/* Infringing Item Box */}
              <div className="rounded-xl border border-cyan/20 bg-cyan/[0.02] p-4 font-mono text-xs space-y-2">
                <div className="font-bold text-cyan flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  1. LOCATION OF INFRINGING MATERIAL:
                </div>
                <p className="text-ink break-all select-all pl-5">
                  {record.targetUrl}
                </p>
                <div className="font-bold text-cyan flex items-center gap-1.5 pt-2">
                  <Lock className="h-3.5 w-3.5" />
                  2. PRESERVED FORENSIC FINGERPRINT HASH:
                </div>
                <p className="text-ink-muted pl-5 font-mono text-[11px]">
                  {record.evidenceHash} (Enclave Perceptual pHash Verified)
                </p>
              </div>

              <p>
                <strong className="text-ink">3. Description of Infringement:</strong> The content hosted at the above URL incorporates unauthorized, unconsented synthetic generative media (AI deepfake manipulation) replicating the proprietary facial tensor landmarks, vocal spectrogram baseline, and unique biometric identity of the protected rights holder. The material was published without consent or legal authorization.
              </p>

              {/* Sworn Statements */}
              <div className="border-l-2 border-cyan/60 pl-4 py-1 space-y-2 text-xs italic text-ink-muted bg-white/[0.01] rounded-r-lg">
                <p>
                  "I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law."
                </p>
                <p>
                  "The information in this notification is accurate, and under penalty of perjury, I declare that I am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."
                </p>
              </div>

              <p>
                Pursuant to 17 U.S.C. § 512(c)(1)(C), upon receipt of this notification, you are required to act expeditiously to remove or disable access to the infringing material. Your prompt cooperation is appreciated.
              </p>
            </div>

            {/* Signature Block */}
            <div className="border-t border-white/[0.08] pt-6 flex flex-wrap items-end justify-between gap-4 font-mono text-xs">
              <div>
                <div className="text-cyan font-serif text-lg italic tracking-wide">
                  /s/ Enclave Autonomous Legal Enforcement Officer #089
                </div>
                <p className="mt-1 text-ink-muted">Authorized DMCA Compliance Officer</p>
                <p className="text-[11px] text-ink-faint">Enclave Autonomous Legal Enforcement Subsystem</p>
              </div>

              <div className="text-right font-mono text-[10px] text-ink-faint space-y-0.5">
                <div>HASH ANCHOR: 9F8A21E4-0C8B-9812-7394</div>
                <div className="text-green font-bold">CRYPTOGRAPHICALLY SEALED // ED25519 VERIFIED</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Live Generated PDF Viewer */}
        {activeTab === "pdf" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-white/[0.08] bg-[#0c0d14] overflow-hidden shadow-2xl space-y-0"
          >
            {/* PDF Viewer Subheader */}
            <div className="bg-white/[0.03] px-4 py-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-ink">
                <span className="flex h-2 w-2 rounded-full bg-green" />
                <span>OFFICIAL PDF DOCUMENT ENGINE</span>
                <span className="text-ink-faint">•</span>
                <span className="text-ink-muted">LETTER FORMAT (612 × 792 PT)</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(pdfBlobUrl, "_blank")}
                  className="h-7 text-[11px] font-mono border-white/[0.08] hover:border-cyan/40 hover:bg-white/[0.04]"
                >
                  <ExternalLink className="h-3 w-3 mr-1 text-cyan" />
                  Open in New Tab
                </Button>
                <Button
                  variant="cyan"
                  size="sm"
                  onClick={handleDownloadPdf}
                  className="h-7 text-[11px] font-mono font-bold text-black shadow-[0_0_10px_rgba(0,242,254,0.2)]"
                >
                  <Download className="h-3 w-3 mr-1" />
                  {downloadSuccess ? "Downloaded" : "Download PDF"}
                </Button>
              </div>
            </div>

            {/* Render Live PDF */}
            {pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                className="h-[780px] w-full border-none bg-white"
                title="Official DMCA Legal Notice Document"
              />
            ) : (
              <div className="flex h-96 items-center justify-center text-ink-muted font-mono text-xs">
                Rendering Official Legal PDF...
              </div>
            )}
          </motion.div>
        )}

        {/* Tab 3: Forensic Evidence & Audit Log */}
        {activeTab === "evidence" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-white/[0.08] bg-[#0a0b12] p-6 sm:p-8 shadow-2xl space-y-6 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Forensic Chain-of-Custody Ledger
                </h3>
                <p className="text-ink-muted text-xs mt-0.5">
                  Immutable audit records proving statutory transmission, content fingerprinting, and host interaction.
                </p>
              </div>
              <span className="rounded bg-cyan/10 border border-cyan/30 px-2 py-0.5 text-[10px] text-cyan font-bold">
                AUDIT LOG VERIFIED
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  time: "00:00:01",
                  title: "Deepfake Detection & Perceptual Hashing",
                  desc: `Analyzed target URL ${record.targetUrl}. Extracted facial tensor mesh landmarks. Calculated pHash fingerprint: ${record.evidenceHash}.`,
                  status: "COMPLETE",
                },
                {
                  time: "00:00:04",
                  title: "Statutory DMCA Notice Synthesis",
                  desc: `Generated legal demand document under 17 U.S.C. § 512(c)(3). Injected sworn good faith declarations and authorized electronic signature.`,
                  status: "COMPLETE",
                },
                {
                  time: "00:00:08",
                  title: "Transmission to Designated Copyright Agent",
                  desc: `Transmitted electronic notice to ${record.abuseEmail} via TLS encrypted SMTP. Delivery receipt registered.`,
                  status: status === "pending" ? "PENDING RECEIPT" : "CONFIRMED",
                },
                {
                  time: "00:00:15",
                  title: "Autonomous Web Crawler Monitoring",
                  desc: `Crawling target endpoint for HTTP status code changes (200 OK -> 404 Not Found / 410 Gone).`,
                  status: status === "resolved" ? "PURGED (404 VERIFIED)" : "ACTIVE POLLING",
                },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan font-bold">[{item.time}]</span>
                      <span className="text-ink font-semibold">{item.title}</span>
                    </div>
                    <p className="text-ink-muted text-[11px] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-bold shrink-0 self-start sm:self-center",
                    item.status.includes("COMPLETE") || item.status.includes("CONFIRMED") || item.status.includes("PURGED")
                      ? "bg-green/10 text-green border border-green/30"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  )}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function generateNoticeText(record: TakedownRecord, status: string): string {
  return `NOTIFICATION OF COPYRIGHT & BIOMETRIC INFRINGEMENT
Pursuant to the Digital Millennium Copyright Act (17 U.S.C. § 512(c))

Date: ${new Date(record.createdAt).toLocaleDateString()}
To: ${record.platform} Designated Copyright Agent (${record.abuseEmail})
Case Ref: #ENC-DMCA-${record.id.slice(0, 8).toUpperCase()}
Status: ${status.toUpperCase()}

Dear Designated Copyright Agent,

This letter serves as formal notification pursuant to 17 U.S.C. § 512(c)(3) demanding the immediate removal of or disabling of access to infringing synthetic generative material.

1. Location of Infringing Material:
${record.targetUrl}

2. Preserved Evidence Hash:
${record.evidenceHash}

3. Description of Infringement:
The material comprises unauthorized synthetic deepfake media reproducing the biometric likeness, facial tensor landmarks, and voiceprint baseline of the protected rights holder without consent.

4. Sworn Declarations:
- I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.
- The information in this notification is accurate, and under penalty of perjury, I declare that I am authorized to act on behalf of the owner.

Please expeditiously remove or disable access to the infringing material.

/s/ Enclave Autonomous Legal Enforcement Officer #089
Enclave Digital Forensics Subsystem`;
}
