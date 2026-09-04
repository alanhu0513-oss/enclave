import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  Shield,
  ScanSearch,
  Bell,
  Radar,
  Lock,
  Eye,
  CheckCircle2,
  ArrowRight,
  Star,
  Menu,
  X,
  ChevronDown,
  Zap,
  Globe,
  FileWarning,
  Fingerprint,
  Gauge,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

/* ═══════════════════════════════════════════════════════════
   CYBERTECH DESIGN TOKENS — scoped to the landing page
   Deep obsidian canvas · electric cyan / hyper teal accents
   neon coral alerts · strict 1px borders · floating neon depth
   ═══════════════════════════════════════════════════════════ */
const tk = {
  /* Backgrounds */
  bgBase: "#040406",
  bgCanvas: "#050507",
  bgRaised: "#0A0A0D",
  surface: "#0D0E12",
  surfaceRaised: "#121318",
  surfaceHover: "#17181D",

  /* Accents */
  cyan: "#00F2FE",
  teal: "#05F2C7",
  coral: "#FF3366",

  /* Ink */
  ink: "#F4F7FB",
  inkMuted: "#9BA3B2",
  inkFaint: "#6B7280",

  /* Borders */
  border: "rgba(255,255,255,0.06)",
  borderHover: "rgba(0,242,254,0.35)",

  /* Glass */
  glass: "rgba(13,14,18,0.7)",
} as const;

const cssVars = {
  "--tk-bg": tk.bgBase,
  "--tk-surface": tk.surface,
  "--tk-surface-raised": tk.surfaceRaised,
  "--tk-cyan": tk.cyan,
  "--tk-teal": tk.teal,
  "--tk-coral": tk.coral,
  "--tk-ink": tk.ink,
  "--tk-ink-muted": tk.inkMuted,
  "--tk-border": tk.border,
} as React.CSSProperties;

/* Glass / card primitives — keep hover transitions incredibly fluid */
const CARD =
  "relative rounded-2xl border backdrop-blur-md transition-all duration-300 ease-out will-change-transform";
const CARD_SURFACE = `border-[rgba(255,255,255,0.06)] bg-[rgba(13,14,18,0.7)]`;
const CARD_HOVER =
  "hover:border-[rgba(0,242,254,0.35)] hover:-translate-y-1 hover:bg-[rgba(17,18,23,0.85)] hover:shadow-[0_20px_60px_-20px_rgba(0,242,254,0.15)]";

/* Gradient text — cyan → teal */
const G_TEXT =
  "bg-gradient-to-r from-[#00F2FE] via-[#05F2C7] to-[#00F2FE] bg-clip-text text-transparent";
const G_TEXT_SOFT =
  "bg-gradient-to-r from-[#00F2FE] to-[#05F2C7] bg-clip-text text-transparent";

/* ─── Data ─── */
const FEATURES = [
  {
    icon: ScanSearch,
    title: "Deepfake Detection",
    desc: "Neural networks analyze images, audio, and video frame-by-frame. Not keyword matching — real ML inference catching manipulation before it spreads.",
    accent: "cyan",
    span: "md:col-span-2 md:row-span-2",
    visual: "ring",
    ringValue: 95,
  },
  {
    icon: Radar,
    title: "Dark Web Monitoring",
    desc: "Continuous scanning across surface web, Reddit, paste sites, and hidden forums.",
    accent: "violet",
    span: "",
    visual: "spark",
  },
  {
    icon: Bell,
    title: "Threat Alerts",
    desc: "Real-time push notifications and email the moment something is found.",
    accent: "teal",
    span: "",
    visual: "list",
  },
  {
    icon: Shield,
    title: "Auto Takedown",
    desc: "Automatic DMCA notices with 48-hour escalation and evidence preservation.",
    accent: "cyan",
    span: "",
    visual: "none",
  },
  {
    icon: Lock,
    title: "Content Watermarking",
    desc: "Invisible watermarks and C2PA credentials prove ownership and deter theft.",
    accent: "teal",
    span: "md:col-span-2",
    visual: "bars",
  },
  {
    icon: Eye,
    title: "Face Analysis",
    desc: "Detect and compare multiple faces against your enrolled biometric profile.",
    accent: "violet",
    span: "",
    visual: "faces",
  },
];

const TIERS = [
  {
    name: "Free",
    tagline: "For people who want to check in",
    price: "$0",
    period: "forever",
    features: ["3 scans/month", "Surface web only", "Basic alerts", "Community support"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    tagline: "For creators who can't afford a breach",
    price: "$9.99",
    period: "/month",
    features: ["50 scans/month", "Web + Reddit + Paste sites", "Hourly monitoring", "2 takedowns/mo", "Priority support"],
    cta: "Get Pro",
    popular: false,
  },
  {
    name: "Shield",
    tagline: "For anyone who needs the full picture",
    price: "$19.99",
    period: "/month",
    features: ["200 scans/month", "All sources + Dark web", "Real-time alerts", "10 takedowns/mo", "Evidence chain", "Voice auth"],
    cta: "Get Shield",
    popular: true,
  },
  {
    name: "Family",
    tagline: "For protecting the people you love",
    price: "$29.99",
    period: "/month",
    features: ["500 scans, up to 5 members", "Dark web + forums + Telegram", "20 takedowns/mo", "Per-member alerts", "Family dashboard"],
    cta: "Get Family",
    popular: false,
  },
  {
    name: "Business",
    tagline: "For teams that take security seriously",
    price: "$49.99",
    period: "/month",
    features: ["Unlimited scans, 10 seats", "15-min monitoring + social", "Unlimited takedowns", "API access", "Audit logs + SSO"],
    cta: "Contact Sales",
    popular: false,
  },
];

const STATS = [
  { value: 2000000, suffix: "+", label: "Images Analyzed", mono: true },
  { value: 95, suffix: "%", label: "Detection Accuracy", mono: true },
  { value: 50000, suffix: "+", label: "Threats Blocked", mono: true },
  { value: 99.9, suffix: "%", label: "Uptime", mono: true },
];

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Content Creator",
    text: "Found deepfakes of me on 3 different sites within hours. The auto-takedown saved me weeks of work. I didn't have to file a single form myself.",
    rating: 5,
    accent: "#00F2FE",
    initials: "SC",
  },
  {
    name: "Marcus Rodriguez",
    role: "Privacy Advocate",
    text: "Finally a tool that takes identity protection seriously. The dark web monitoring is something else.",
    rating: 5,
    accent: "#05F2C7",
    initials: "MR",
  },
  {
    name: "Dr. Aisha Patel",
    role: "Public Figure",
    text: "The watermarking feature alone is worth it. I now have proof of ownership for all my content.",
    rating: 5,
    accent: "#A78BFA",
    initials: "AP",
  },
];

const LOGOS = ["FORRER", "N0VATECH", "DARKNET-WATCH", "SECURY", "PARALLAX", "ORBITAL"];

const FAQ = [
  {
    q: "How does deepfake detection actually work?",
    a: "We run a multi-layered detection pipeline. First, MTCNN extracts faces from images. Then XceptionNet — a convolutional neural network trained on manipulation datasets like FaceForensics++ — classifies each face as real or synthetic. For audio, we use Librosa spectral analysis to detect voice cloning artifacts. Every result gets a confidence score and a human-readable explanation. No magic, no buzzwords — just ML inference on real hardware.",
  },
  {
    q: "What sources do you scan?",
    a: "We scan the surface web via search engine APIs, social media platforms like Reddit and X, paste sites such as Pastebin and Ghostbin, dark web forums and marketplaces, Telegram channels, and file-sharing platforms. Pro plans and above get hourly monitoring with real-time alerts. Shield plans add dark web crawling with Tor integration.",
  },
  {
    q: "How fast are takedowns?",
    a: "Our system auto-generates DMCA notices within minutes of detection and sends them directly to platform abuse teams via email. Most platforms respond within 48 hours. If they don't, we automatically escalate with follow-up notices. Throughout the process, we preserve evidence including HTML snapshots, metadata, and screenshots for potential legal proceedings.",
  },
  {
    q: "Is my biometric data safe?",
    a: "We never store raw photos of your face. When you enroll, we convert your face into a one-way biometric hash called a faceprint using homomorphic encryption. This means even we cannot reverse-engineer your photo from the stored data. You can delete your biometric data at any time from your account settings, and it will be permanently removed from our systems.",
  },
  {
    q: "Can I try before I buy?",
    a: "Absolutely. The Free plan gives you 3 scans per month with surface web monitoring, and it never expires. No credit card required to sign up. You get real detection results, real alerts, and a real dashboard. Upgrade to Pro or Shield when you need more scans, faster monitoring, dark web coverage, or automated takedowns.",
  },
  {
    q: "What happens if a deepfake is found of me?",
    a: "You get an instant alert with the confidence score, source URL, and a screenshot of the content. If you're on a plan with takedowns, we automatically generate and send a DMCA notice to the hosting provider. You can track the takedown lifecycle in your dashboard. Evidence is preserved in case you need it for legal action.",
  },
];

/* Palette helpers */
const ACCENT = {
  cyan: { text: "text-[#00F2FE]", chip: "bg-[#00F2FE]/10 border-[#00F2FE]/20", glow: "shadow-[0_0_30px_rgba(0,242,254,0.12)]" },
  teal: { text: "text-[#05F2C7]", chip: "bg-[#05F2C7]/10 border-[#05F2C7]/20", glow: "shadow-[0_0_30px_rgba(5,242,199,0.12)]" },
  violet: { text: "text-[#A78BFA]", chip: "bg-[#A78BFA]/10 border-[#A78BFA]/20", glow: "shadow-[0_0_30px_rgba(167,139,250,0.12)]" },
  coral: { text: "text-[#FF3366]", chip: "bg-[#FF3366]/10 border-[#FF3366]/20", glow: "shadow-[0_0_30px_rgba(255,51,102,0.12)]" },
};

/* ─── Count-up hook ─── */
function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return { count, ref };
}

/* ─── Glowing status ring (minimal data viz) ─── */
function Ring({ value, size = 120, stroke = 6, color = "#00F2FE" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-lg font-semibold tracking-tight text-[#F4F7FB]">{value}%</span>
      </div>
    </div>
  );
}

/* ─── Thin-line sparkline (minimal data viz) ─── */
function Sparkline({ points, color = "#05F2C7", width = 220, height = 64 }: { points: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const pad = 4;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = height - pad - ((p - min) / (max - min || 1)) * (height - pad * 2);
    return `${x},${y}`;
  });
  const path = `M${coords.join(" L")}`;
  const area = `${path} L${width - pad},${height} L${pad},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`spark-fill-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-fill-${color.replace("#", "")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      <circle cx={width - pad} cy={height - pad - ((points[points.length - 1] - min) / (max - min || 1)) * (height - pad * 2)} r="2.5" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </svg>
  );
}

/* ─── Ambient background layers ─── */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Radial neon glows — floating depth, opacity-10 */}
      <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[#00F2FE] opacity-10 blur-[140px]" />
      <div className="absolute top-1/3 -left-40 h-[420px] w-[420px] rounded-full bg-[#05F2C7] opacity-[0.08] blur-[130px]" />
      <div className="absolute top-1/4 -right-32 h-[380px] w-[380px] rounded-full bg-[#A78BFA] opacity-[0.07] blur-[130px]" />
      {/* Grid texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 70%)",
        }}
      />
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

/* ─── Main Component ─── */
export function LandingPage({ onGetStarted }: { onGetStarted?: () => void }) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (user) return null;

  function handleGetStarted() {
    if (onGetStarted) onGetStarted();
  }

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <div className="min-h-screen bg-[var(--tk-bg)] text-[var(--tk-ink)] antialiased" style={cssVars}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-[#00F2FE] focus:text-black focus:px-4 focus:py-2">Skip to content</a>

      {/* ───────── Navigation — floating glass bar ───────── */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4"
      >
        <nav
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-4 py-2.5 transition-all duration-300 ease-out ${
            navScrolled
              ? "border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,13,0.75)] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8)]"
              : "border-transparent bg-transparent"
          }`}
        >
          <a href="#" className="flex items-center gap-2.5" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00F2FE]/25 bg-gradient-to-br from-[#00F2FE]/20 to-[#05F2C7]/10 shadow-[0_0_16px_rgba(0,242,254,0.25)]">
              <Shield className="h-4 w-4 text-[#00F2FE]" aria-hidden="true" />
            </div>
            <span className="font-[var(--font-sans)] text-lg font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>Enclave</span>
          </a>

          <div className="hidden items-center gap-7 md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-[var(--tk-ink-muted)] transition-colors duration-300 ease-out hover:text-[var(--tk-ink)]">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleGetStarted}
              className="hidden px-3 py-1.5 text-sm text-[var(--tk-ink-muted)] transition-all duration-300 ease-out hover:text-[var(--tk-ink)] md:block"
            >
              Sign in
            </button>
            <button
              onClick={handleGetStarted}
              className="group relative inline-flex items-center gap-2 rounded-lg border border-[#00F2FE]/30 bg-gradient-to-r from-[#00F2FE]/15 to-[#05F2C7]/10 px-4 py-2 text-sm font-medium text-[#BEF5F8] transition-all duration-300 ease-out hover:border-[#00F2FE]/60 hover:shadow-[0_0_24px_rgba(0,242,254,0.35)] active:scale-[0.98]"
            >
              Protect my identity
              <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
            <button
              className="text-[var(--tk-ink-muted)] md:hidden"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mx-auto mt-2 max-w-6xl overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,13,0.85)] backdrop-blur-xl md:hidden"
            >
              <div className="space-y-1 p-3">
                {navLinks.map((l) => (
                  <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-[var(--tk-ink-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--tk-ink)]">
                    {l.label}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <main id="main-content" className="relative">
        <Backdrop />

        {/* ═══════════════════════════════════════════════════════ */}
        {/* HERO                                                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section className="relative px-4 pt-36 sm:pt-40">
          <div className="mx-auto max-w-6xl">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex justify-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00F2FE]/25 bg-[#00F2FE]/[0.06] px-4 py-1.5 text-xs font-medium tracking-wide text-[#7FEFFF]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F2FE] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00F2FE]" />
                </span>
                ML-powered identity protection · Live
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
              className="mt-8 text-center font-[var(--font-sans)] text-5xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-7xl lg:text-[5.5rem]"
            >
              Your face is{" "}
              <span className={G_TEXT}>yours</span>.
              <br />
              <span className="text-[var(--tk-ink-muted)]">Keep it that way.</span>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-[var(--tk-ink-muted)] md:text-xl"
            >
              Detect deepfakes, monitor the dark web, and take down unauthorized use of your identity.
              Built with real ML models — not marketing.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
              className="mt-9 flex flex-wrap items-center justify-center gap-4"
            >
              <button
                onClick={handleGetStarted}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-transparent bg-gradient-to-r from-[#00F2FE] via-[#05F2C7] to-[#00F2FE] px-8 py-3.5 text-base font-semibold text-black transition-all duration-300 ease-out hover:shadow-[0_0_40px_rgba(0,242,254,0.45)] active:scale-[0.98]"
              >
                Scan my face for free
                <ArrowRight className="h-5 w-5 transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden="true" />
              </button>
              <a href="#how-it-works">
                <button className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(13,14,18,0.6)] px-8 py-3.5 text-base text-[var(--tk-ink)] backdrop-blur-md transition-all duration-300 ease-out hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(18,19,24,0.8)] active:scale-[0.98]">
                  See how it works
                </button>
              </a>
            </motion.div>

            {/* Risk reducer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-4 text-center text-xs font-mono text-[var(--tk-ink-faint)]"
            >
              No credit card required · Free forever plan · 3 scans/mo
            </motion.p>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["#00F2FE", "#05F2C7", "#A78BFA", "#FF3366", "#3B82F6"].map((color, i) => (
                    <div
                      key={i}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#050507] text-[11px] font-bold text-black"
                      style={{ backgroundColor: color, zIndex: 5 - i }}
                    >
                      {["S", "M", "A", "K", "J"][i]}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-[var(--tk-ink-muted)]">
                  Join <span className="font-medium text-[var(--tk-ink)]">2,400+</span> people protecting their identity
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* PRODUCT VISUAL — animated dashboard mockup with glow      */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section className="relative px-4 pb-4 pt-20">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Ambient glow behind panel */}
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-[#00F2FE]/10 via-transparent to-[#A78BFA]/10 blur-2xl" />

              {/* Panel frame */}
              <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(10,10,13,0.85)] backdrop-blur-xl shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]">
                {/* Scanning line */}
                <motion.div
                  className="absolute left-0 right-0 z-10 h-px bg-gradient-to-r from-transparent via-[#00F2FE]/60 to-transparent"
                  animate={{ top: ["0%", "100%"] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
                  style={{ boxShadow: "0 0 12px rgba(0,242,254,0.5)", willChange: "top" }}
                />
                {/* Title bar */}
                <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
                  <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                  <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                  <div className="h-3 w-3 rounded-full bg-[#28C840]" />
                  <span className="ml-3 text-xs font-mono text-[var(--tk-ink-faint)]">enclave — command center</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#05F2C7]/25 bg-[#05F2C7]/10 px-2.5 py-0.5 text-[10px] font-mono text-[#05F2C7]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#05F2C7] animate-pulse" />
                    MONITORING
                  </span>
                </div>
                {/* Panel body */}
                <div className="grid grid-cols-12 gap-0">
                  {/* Sidebar */}
                  <div className="col-span-3 hidden border-r border-[rgba(255,255,255,0.06)] p-4 md:block">
                    {[
                      { label: "Overview", icon: Gauge },
                      { label: "Scans", icon: ScanSearch },
                      { label: "Alerts", icon: Bell },
                      { label: "Takedowns", icon: FileWarning },
                      { label: "Passport", icon: Fingerprint },
                    ].map((item, i) => (
                      <div
                        key={item.label}
                        className={`mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
                          i === 0 ? "bg-[#00F2FE]/10 text-[#7FEFFF]" : "text-[var(--tk-ink-faint)] hover:text-[var(--tk-ink-muted)]"
                        }`}
                      >
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[13px]">{item.label}</span>
                      </div>
                    ))}
                    <div className="mt-6 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                      <p className="text-[11px] font-mono text-[var(--tk-ink-faint)]">SHIELD STATUS</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#05F2C7] opacity-60" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#05F2C7]" />
                        </span>
                        <span className="text-xs font-medium text-[#7bf7dc]">Active</span>
                      </div>
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="col-span-12 md:col-span-9 p-5">
                    {/* Stats row */}
                    <div className="mb-5 grid grid-cols-3 gap-3">
                      {[
                        { label: "ACTIVE SCANS", value: "12", color: "#00F2FE" },
                        { label: "THREATS FOUND", value: "3", color: "#FF3366" },
                        { label: "TAKEDOWNS", value: "8", color: "#05F2C7" },
                      ].map((s) => (
                        <div key={s.label} className={`${CARD} ${CARD_SURFACE} p-3.5`} style={{ willChange: "none" }}>
                          <p className="text-[10px] font-mono tracking-wide text-[var(--tk-ink-faint)]">{s.label}</p>
                          <p className="mt-1 font-mono text-2xl font-semibold" style={{ color: s.color }}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recent alerts */}
                    <div className="space-y-2">
                      {[
                        { icon: ScanSearch, title: "Image scan complete", detail: "photo_2024.jpg — No manipulation detected", status: "Safe", accent: "teal" },
                        { icon: Radar, title: "Dark web match", detail: "Your image found on suspicious forum", status: "Threat", accent: "coral" },
                        { icon: Shield, title: "Takedown sent", detail: "DMCA notice to hosting provider", status: "In progress", accent: "cyan" },
                        { icon: Eye, title: "Face match", detail: "2 faces found in scanned content", status: "Review", accent: "violet" },
                      ].map((alert) => (
                        <div key={alert.title} className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 transition-colors duration-200 hover:bg-[rgba(255,255,255,0.04)]">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ACCENT[alert.accent as keyof typeof ACCENT].chip}`}>
                            <alert.icon className={`h-4 w-4 ${ACCENT[alert.accent as keyof typeof ACCENT].text}`} aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{alert.title}</p>
                            <p className="truncate text-[13px] text-[var(--tk-ink-faint)]">{alert.detail}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-mono ${ACCENT[alert.accent as keyof typeof ACCENT].chip} ${ACCENT[alert.accent as keyof typeof ACCENT].text}`}>
                            {alert.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* LOGO STRIP — trust via recognizable names                */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section className="px-4 pt-16">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-mono uppercase tracking-[0.2em] text-[var(--tk-ink-faint)]">
              Trusted by security-conscious teams & creators
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-50">
              {LOGOS.map((l) => (
                <span key={l} className="font-mono text-sm tracking-widest text-[var(--tk-ink-muted)]">{l}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* FEATURES — premium bento grid                            */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section id="features" className="relative px-4 py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[#7FEFFF]">Capabilities</p>
              <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                Everything Enclave does
                <br />
                <span className="text-[var(--tk-ink-muted)]">under the hood</span>
              </h2>
              <p className="mt-4 text-lg text-[var(--tk-ink-muted)]">
                Six core capabilities, each backed by real infrastructure — not marketing slides.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                const a = ACCENT[f.accent as keyof typeof ACCENT];
                return (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: (i % 4) * 0.06 }}
                    className={`${CARD} ${CARD_SURFACE} ${CARD_HOVER} group p-6 ${f.span}`}
                  >
                    {/* Hover glow accent */}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `inset 0 1px 0 0 ${f.accent === "cyan" ? "rgba(0,242,254,0.15)" : f.accent === "teal" ? "rgba(5,242,199,0.15)" : "rgba(167,139,250,0.15)"}`, background: `radial-gradient(120% 100% at 50% 0%, ${f.accent === "cyan" ? "rgba(0,242,254,0.05)" : f.accent === "teal" ? "rgba(5,242,199,0.05)" : "rgba(167,139,250,0.05)"}, transparent)` }} />

                    <div className="relative">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${a.chip}`}>
                        <Icon className={`h-5 w-5 ${a.text}`} aria-hidden="true" />
                      </div>

                      {/* Feature visuals — minimalist data viz */}
                      {f.visual === "ring" && (
                        <div className="mt-6 flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>
                            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--tk-ink-muted)]">{f.desc}</p>
                          </div>
                          <Ring value={f.ringValue ?? 95} size={110} color="#00F2FE" />
                        </div>
                      )}

                      {f.visual === "spark" && (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--tk-ink-muted)]">{f.desc}</p>
                          <div className="mt-5 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[10px] font-mono text-[var(--tk-ink-faint)]">FORUM + DARK WEB</span>
                              <span className="text-[10px] font-mono text-[#05F2C7]">+184%</span>
                            </div>
                            <Sparkline points={[12, 18, 14, 22, 19, 30, 26, 42, 38, 58, 52, 74]} color="#05F2C7" />
                          </div>
                        </div>
                      )}

                      {f.visual === "list" && (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--tk-ink-muted)]">{f.desc}</p>
                          <div className="mt-5 space-y-2">
                            {[
                              { label: "Deepfake of you detected", t: "2m", color: "#FF3366" },
                              { label: "Image posted to Telegram", t: "4m", color: "#FF3366" },
                              { label: "DMCA notice sent", t: "6m", color: "#05F2C7" },
                            ].map((r) => (
                              <div key={r.label} className="flex items-center gap-2.5 rounded-lg border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: r.color, boxShadow: `0 0 6px ${r.color}` }} />
                                <span className="flex-1 truncate text-[13px] text-[var(--tk-ink-muted)]">{r.label}</span>
                                <span className="font-mono text-[10px] text-[var(--tk-ink-faint)]">{r.t}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {f.visual === "bars" && (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--tk-ink-muted)]">{f.desc}</p>
                          <div className="mt-5 flex h-16 items-end gap-1.5">
                            {[35, 55, 45, 70, 60, 85, 65, 92, 74, 100].map((h, j) => (
                              <div key={j} className="flex-1 rounded-t-sm bg-gradient-to-t from-[#00F2FE]/10 to-[#05F2C7]/60" style={{ height: `${h}%`, filter: "drop-shadow(0 0 4px rgba(0,242,254,0.2))" }} />
                            ))}
                          </div>
                        </div>
                      )}

                      {f.visual === "faces" && (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--tk-ink-muted)]">{f.desc}</p>
                        </div>
                      )}

                      {f.visual === "none" && (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--tk-ink-muted)]">{f.desc}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STATS — count-up                                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className={`${CARD} ${CARD_SURFACE} grid grid-cols-2 gap-8 p-8 md:grid-cols-4 md:p-12`}>
              {STATS.map((stat) => (
                <StatCounter key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* HOW IT WORKS                                              */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="px-4 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[#7FEFFF]">Workflow</p>
              <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                Three steps to protection
              </h2>
              <p className="mt-4 text-lg text-[var(--tk-ink-muted)]">No setup wizard. No 30-minute onboarding.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { step: "01", title: "Enroll your face", desc: "Upload a photo. We create a biometric hash in seconds. Your raw photo is never stored.", icon: Eye },
                { step: "02", title: "We scan everywhere", desc: "Surface web, social media, paste sites, dark web forums, Telegram. Continuously.", icon: Globe },
                { step: "03", title: "We act", desc: "Instant alerts. Automatic DMCA takedowns. Evidence preserved for legal use.", icon: Zap },
              ].map((item) => (
                <div key={item.step} className={`${CARD} ${CARD_SURFACE} ${CARD_HOVER} group p-6`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-4xl font-bold text-[#00F2FE]/25 transition-colors duration-300 group-hover:text-[#00F2FE]/50">{item.step}</span>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${ACCENT.cyan.chip}`}>
                      <item.icon className={`h-5 w-5 ${ACCENT.cyan.text}`} aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--tk-ink-muted)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* PRICING                                                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section id="pricing" className="px-4 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[#7FEFFF]">Pricing</p>
              <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                Start free. Scale when you need it.
              </h2>
              <p className="mt-4 text-lg text-[var(--tk-ink-muted)]">No card required to begin. Cancel anytime.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {TIERS.map((tier) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: (TIERS.indexOf(tier) % 5) * 0.05 }}
                  className={`${CARD} relative p-5 ${
                    tier.popular
                      ? "border-[#00F2FE]/40 bg-gradient-to-b from-[#00F2FE]/[0.08] to-[rgba(13,14,18,0.7)] lg:-translate-y-2"
                      : `${CARD_SURFACE} ${CARD_HOVER}`
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#00F2FE] to-[#05F2C7] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(0,242,254,0.4)]">
                      Most popular
                    </div>
                  )}
                  <h3 className="font-semibold tracking-tight">{tier.name}</h3>
                  <p className="mt-1 text-[13px] italic text-[var(--tk-ink-faint)]">{tier.tagline}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className={`font-mono text-3xl font-semibold tracking-tight ${tier.popular ? G_TEXT_SOFT : ""}`}>{tier.price}</span>
                    <span className="text-[13px] text-[var(--tk-ink-faint)]">{tier.period}</span>
                  </div>
                  <ul className="mt-5 space-y-2">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-[13px] text-[var(--tk-ink-muted)]">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#05F2C7]" aria-hidden="true" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleGetStarted}
                    className={`mt-6 w-full rounded-lg py-2.5 text-sm font-medium transition-all duration-300 ease-out active:scale-[0.98] ${
                      tier.popular
                        ? "bg-gradient-to-r from-[#00F2FE] via-[#05F2C7] to-[#00F2FE] text-black hover:shadow-[0_0_30px_rgba(0,242,254,0.4)]"
                        : "border border-[rgba(255,255,255,0.12)] text-[var(--tk-ink)] hover:border-[rgba(255,255,255,0.25)] hover:bg-white/[0.04]"
                    }`}
                  >
                    {tier.cta}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TESTIMONIALS                                              */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section id="testimonials" className="px-4 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[#7FEFFF]">Testimonials</p>
              <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                What people say
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <div className={`${CARD} ${CARD_SURFACE} ${CARD_HOVER} md:col-span-3 p-6`}>
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: TESTIMONIALS[0].rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-[#00F2FE] text-[#00F2FE]" aria-hidden="true" />
                  ))}
                </div>
                <p className="text-lg leading-relaxed text-[var(--tk-ink)]">&ldquo;{TESTIMONIALS[0].text}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-black" style={{ backgroundColor: TESTIMONIALS[0].accent }}>
                    {TESTIMONIALS[0].initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{TESTIMONIALS[0].name}</p>
                    <p className="text-sm text-[var(--tk-ink-faint)]">{TESTIMONIALS[0].role}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 md:col-span-2">
                {TESTIMONIALS.slice(1, 3).map((t) => (
                  <div key={t.name} className={`${CARD} ${CARD_SURFACE} ${CARD_HOVER} flex-1 p-5`}>
                    <div className="mb-2 flex gap-0.5">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5 fill-[#00F2FE] text-[#00F2FE]" aria-hidden="true" />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--tk-ink-muted)]">&ldquo;{t.text}&rdquo;</p>
                    <div className="mt-4 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-black" style={{ backgroundColor: t.accent }}>
                        {t.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-[13px] text-[var(--tk-ink-faint)]">{t.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* FAQ                                                        */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section id="faq" className="px-4 py-24">
          <div className="mx-auto max-w-2xl">
            <div className="mb-12 text-center">
              <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[#7FEFFF]">FAQ</p>
              <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                Frequently asked questions
              </h2>
            </div>

            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <div key={i} className={`${CARD} ${CARD_SURFACE} overflow-hidden`} style={{ willChange: "none" }}>
                  <button
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span className="text-[15px] font-medium tracking-tight pr-4">{item.q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--tk-ink-faint)] transition-transform duration-300 ${openFaq === i ? "rotate-180 text-[#00F2FE]" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 text-sm leading-relaxed text-[var(--tk-ink-muted)]">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* CTA                                                       */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section className="px-4 py-24">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-3xl border border-[#00F2FE]/25 p-12 text-center"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#00F2FE]/[0.12] via-transparent to-[#05F2C7]/[0.12]" />
              <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-[#00F2FE]/20 blur-[100px]" />
              <div className="relative">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00F2FE]/30 bg-gradient-to-br from-[#00F2FE]/20 to-[#05F2C7]/10 shadow-[0_0_30px_rgba(0,242,254,0.3)]">
                  <Shield className="h-7 w-7 text-[#00F2FE]" aria-hidden="true" />
                </div>
                <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                  Protect your identity <span className={G_TEXT}>today</span>
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--tk-ink-muted)]">
                  Free to start. No credit card required. Join thousands who already use Enclave to protect their face, voice, and digital identity.
                </p>
                <button
                  onClick={handleGetStarted}
                  className="group mt-9 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] via-[#05F2C7] to-[#00F2FE] px-10 py-4 text-base font-semibold text-black transition-all duration-300 ease-out hover:shadow-[0_0_45px_rgba(0,242,254,0.45)] active:scale-[0.98]"
                >
                  Scan my face for free
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* FOOTER — dense links                                      */}
        {/* ═══════════════════════════════════════════════════════ */}
        <footer className="border-t border-[rgba(255,255,255,0.06)] px-4 py-14">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col justify-between gap-10 md:flex-row">
              <div className="max-w-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00F2FE]/25 bg-gradient-to-br from-[#00F2FE]/20 to-[#05F2C7]/10">
                    <Shield className="h-3.5 w-3.5 text-[#00F2FE]" aria-hidden="true" />
                  </div>
                  <span className="font-semibold tracking-tight">Enclave</span>
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-[var(--tk-ink-faint)]">
                  AI-powered deepfake detection and identity protection. Built with real ML — not marketing.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
                <div>
                  <p className="mb-3 text-xs font-mono uppercase tracking-wider text-[var(--tk-ink-faint)]">Product</p>
                  <ul className="space-y-2 text-sm text-[var(--tk-ink-muted)]">
                    <li><a href="#features" className="transition-colors hover:text-[var(--tk-ink)]">Features</a></li>
                    <li><a href="#pricing" className="transition-colors hover:text-[var(--tk-ink)]">Pricing</a></li>
                    <li><a href="#how-it-works" className="transition-colors hover:text-[var(--tk-ink)]">Workflow</a></li>
                  </ul>
                </div>
                <div>
                  <p className="mb-3 text-xs font-mono uppercase tracking-wider text-[var(--tk-ink-faint)]">Legal</p>
                  <ul className="space-y-2 text-sm text-[var(--tk-ink-muted)]">
                    <li><a href="/privacy" className="transition-colors hover:text-[var(--tk-ink)]">Privacy</a></li>
                    <li><a href="/terms" className="transition-colors hover:text-[var(--tk-ink)]">Terms</a></li>
                    <li><a href="/dmca" className="transition-colors hover:text-[var(--tk-ink)]">DMCA</a></li>
                  </ul>
                </div>
                <div>
                  <p className="mb-3 text-xs font-mono uppercase tracking-wider text-[var(--tk-ink-faint)]">Build</p>
                  <ul className="space-y-2 text-sm text-[var(--tk-ink-muted)]">
                    <li><a href="https://enclave-production-d818.up.railway.app/api-docs" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--tk-ink)]">API</a></li>
                    <li><a href="/blog" className="transition-colors hover:text-[var(--tk-ink)]">Blog</a></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.06)] pt-6 md:flex-row">
              <p className="text-[13px] text-[var(--tk-ink-faint)]">&copy; {new Date().getFullYear()} Enclave. All rights reserved.</p>
              <p className="flex items-center gap-2 text-[13px] text-[var(--tk-ink-faint)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#05F2C7] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#05F2C7]" />
                </span>
                All systems operational
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ─── Stat Counter Component ─── */
function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCountUp(value >= 1000 ? value / 1000 : value, 2000);
  const display = value >= 1000000
    ? `${(count / 1000).toFixed(0)}K${suffix}`
    : value >= 1000
      ? `${count}K${suffix}`
      : `${count}${suffix}`;

  return (
    <div ref={ref} className="text-center">
      <p className="font-mono text-3xl font-semibold tracking-tight text-[#7FEFFF]" style={{ letterSpacing: "-0.02em", textShadow: "0 0 24px rgba(0,242,254,0.25)" }}>
        {display}
      </p>
      <p className="mt-1 text-[13px] text-[var(--tk-ink-faint)]">{label}</p>
    </div>
  );
}
