import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  Shield,
  ShieldCheck,
  ScanSearch,
  Bell,
  Radar,
  CheckCircle2,
  ArrowRight,
  Star,
  Menu,
  X,
  ChevronDown,
  Globe,
  Gauge,
  Siren,
  KeyRound,
  Network,
  Users,
  ShieldAlert,
  TimerReset,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

/* ═══════════════════════════════════════════════════════════
   HUMANIST EDITORIAL DESIGN TOKENS — scoped to the landing page
   Warm charcoal canvas · champagne gold / warm cream accents
   delicate warm grey borders · elegant typographic scaling
   ═══════════════════════════════════════════════════════════ */
const tk = {
  /* Backgrounds */
  bgBase: "#0C0C0E",
  bgCanvas: "#0E0E10",
  bgRaised: "#141417",
  surface: "#17171B",
  surfaceRaised: "#1D1D22",
  surfaceHover: "#232329",

  /* Accents */
  cyan: "#C5A880", // Champagne gold
  teal: "#E5D5C0", // Warm cream
  coral: "#D1A3A4", // Muted rose

  /* Ink */
  ink: "#F4F3F0", // Warm white
  inkMuted: "#A39E98", // Muted warm grey
  inkFaint: "#706C66", // Soft charcoal grey

  /* Borders */
  border: "rgba(229,213,192,0.06)",
  borderHover: "rgba(197,168,128,0.35)",

  /* Glass */
  glass: "rgba(20,20,23,0.7)",
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

/* Glass / card primitives — elegant subtle transitions */
const CARD =
  "relative rounded-2xl border backdrop-blur-md transition-all duration-300 ease-out will-change-transform";
const CARD_SURFACE = `border-[rgba(229,213,192,0.06)] bg-[rgba(20,20,23,0.7)]`;
const CARD_HOVER =
  "hover:border-[rgba(197,168,128,0.35)] hover:-translate-y-1 hover:bg-[rgba(26,26,30,0.85)] hover:shadow-[0_20px_60px_-20px_rgba(197,168,128,0.1)]";

/* Gradient text — Warm brass → champagne */
const G_TEXT =
  "bg-gradient-to-r from-[#E5D5C0] via-[#C5A880] to-[#E5D5C0] bg-clip-text text-transparent";
const G_TEXT_SOFT =
  "bg-gradient-to-r from-[#E5D5C0] to-[#C5A880] bg-clip-text text-transparent";

/* ─── Data ─── */
const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Barrier Intelligence",
    desc: "The Security Shield watches every account against 1.2B+ breached records and live infostealer logs. Every credential gets an exploitability score, and every shard password is mapped across your blast radius.",
    accent: "cyan",
    span: "md:col-span-2 md:row-span-2",
    visual: "shield",
    ringValue: 94,
  },
  {
    icon: Radar,
    title: "Breach + Stealer Sweeps",
    desc: "A 6-hour auto-sweep re-checks your accounts against fresh breach dumps and actively-captured infostealer logs — no manual scanning required.",
    accent: "violet",
    span: "",
    visual: "spark",
  },
  {
    icon: Siren,
    title: "Contain the Blast",
    desc: "When something leaks, one tap opens lockdown playbooks on every affected account, with step-by-step recovery.",
    accent: "coral",
    span: "",
    visual: "list",
  },
  {
    icon: KeyRound,
    title: "Credential Vault",
    desc: "Passwords, 2FA status, and recovery checks encrypted behind the shield — never shown, only scored.",
    accent: "teal",
    span: "",
    visual: "none",
  },
  {
    icon: ScanSearch,
    title: "Deepfake Detection",
    desc: "Neural networks analyze images, audio, and video frame-by-frame. Real ML inference catching manipulation before it spreads.",
    accent: "violet",
    span: "md:col-span-2",
    visual: "bars",
  },
  {
    icon: Globe,
    title: "Dark Web Monitoring",
    desc: "Continuous scanning across surface web, Reddit, paste sites, and hidden forums.",
    accent: "teal",
    span: "",
    visual: "faces",
  },
];

const TIERS = [
  {
    name: "Free",
    tagline: "Behind the shield, lightly",
    price: "$0",
    period: "forever",
    watch: "3 watched accounts",
    features: ["Breach + pwned check on every account", "Encrypted credential vault", "1 lockdown playbook", "3 deepfake scans/month"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    tagline: "The wall goes up",
    price: "$9.99",
    period: "/month",
    watch: "25 watched accounts",
    features: ["Stealer-log + breach auto-sweep every 6h", "Blast-radius contamination mapping", "Contain-all one-tap lockdowns", "10 lockdown playbooks/mo", "50 deepfake scans + paste monitoring"],
    cta: "Get Pro",
    popular: false,
  },
  {
    name: "Shield",
    tagline: "The full barrier",
    price: "$19.99",
    period: "/month",
    watch: "250 watched accounts",
    features: ["Watch 250 accounts — full barrier", "6h auto-sweep across all corpuses", "Unlimited lockdowns + contain-all", "Exploitability scoring per account", "Dark web monitoring + 10 takedowns/mo"],
    cta: "Get Shield",
    popular: true,
  },
  {
    name: "Family",
    tagline: "For the people you love",
    price: "$29.99",
    period: "/month",
    watch: "1,000 accounts · 5 members",
    features: ["Everything in Shield, per member", "Family dashboard + per-member alerts", "Dark web + forums + Telegram", "20 takedowns/mo"],
    cta: "Get Family",
    popular: false,
  },
  {
    name: "Business",
    tagline: "One barrier per seat",
    price: "$49.99",
    period: "/month",
    watch: "Unlimited · 10 seats",
    features: ["Unlimited watched accounts", "15-min real-time sweep + social", "Unlimited lockdowns + takedowns", "API access + audit logs + SSO"],
    cta: "Contact Sales",
    popular: false,
  },
];

const STATS = [
  { value: 1200000000, suffix: "+", label: "Records Checked", mono: true },
  { value: 94, suffix: "%", label: "Barrier Coverage", mono: true },
  { value: 12400, suffix: "+", label: "Exposures Contained", mono: true },
  { value: 99.9, suffix: "%", label: "Sweep Uptime", mono: true },
];

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Content Creator",
    text: "A stealer log on the dark web had my Gmail — Enclave found it before I did, showed me the blast radius across my other accounts, and walked me through rotating everything in one evening.",
    rating: 5,
    accent: "#00F2FE",
    initials: "SC",
  },
  {
    name: "Marcus Rodriguez",
    role: "Privacy Advocate",
    text: "Finally a tool that takes identity protection seriously. The stealer-log monitoring alone caught a credential harvest no one else flagged.",
    rating: 5,
    accent: "#05F2C7",
    initials: "MR",
  },
  {
    name: "Dr. Aisha Patel",
    role: "Public Figure",
    text: "The containment playbooks are what sold me. One tap locked down every account sharing a breached password and told me exactly what to change.",
    rating: 5,
    accent: "#A78BFA",
    initials: "AP",
  },
];

const LOGOS = ["FORRER", "N0VATECH", "DARKNET-WATCH", "SECURY", "PARALLAX", "ORBITAL"];

const FAQ = [
  {
    q: "What exactly does the Security Shield protect?",
    a: "It protects the accounts that hold your identity: email, banking, social, gaming, work. You add each account, optionally vault a credential, and the shield continuously checks those accounts against the 1.2B+ record pwned corpus and Hudson Rock's live infostealer-log feed. When something is exposed, you get an exploitability score, a map of the blast radius (every other account sharing that password or identifier), and a step-by-step lockdown playbook. Higher tiers widen the wall and add the auto-sweep and auto-containment layers.",
  },
  {
    q: "What's a stealer log, and why should I care?",
    a: "Info-stealer malware is the single biggest source of real credential theft right now. When it infects a machine, it harvests everything saved in that browser or password manager — email, passwords, session cookies — and sells or dumps the logs. Enclave queries the live stealer-log corpus by your identifier(s). If your email shows up on an infected machine, the shield tells you which services an attacker can now reach and assumes anything reused is compromised.",
  },
  {
    q: "What is blast-radius mapping?",
    a: "When a credential you use is found in a breach, the shield traces every other account that reuses that exact password or shares an identifier, and flags it 'contaminated' — at risk even though it wasn't directly breached. That's the blast radius: one leaked password silently shards out across your other accounts. Contain-all opens lockdown playbooks on each affected account in one action.",
  },
  {
    q: "Is my biometric data safe?",
    a: "We never store raw photos of your face. When you enroll, we convert your face into a one-way biometric hash called a faceprint using homomorphic encryption. This means even we cannot reverse-engineer your photo from the stored data. You can delete your biometric data at any time from your account settings, and it will be permanently removed from our systems.",
  },
  {
    q: "Can I try before I buy?",
    a: "Absolutely. The Free plan lets you shield up to 3 accounts with breach and pwned-password checks and an encrypted credential vault — it never expires, and no credit card is required to sign up. Upgrade when you want more watched accounts, the 6-hour auto-sweep, stealer-log intelligence, blast-radius mapping, and contain-all lockdowns.",
  },
  {
    q: "How does deepfake detection fit in?",
    a: "The Security Shield is the layer that defends the keys to your identity, and deepfake detection defends your likeness itself. Both run continuously after you sign in. If a deepfake of you is found, you get an instant alert with the confidence score and source, and plans with takedowns auto-generate a DMCA notice and track the removal lifecycle for you.",
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

/* ─── Animated Cyber Network (Visual Depth Nodes) ─── */
function CyberNetwork() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden opacity-30">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="net-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00F2FE" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#net-glow)" />
        <motion.path
          d="M 100,200 L 400,100 L 700,300 L 1000,150"
          fill="none"
          stroke="rgba(0, 242, 254, 0.15)"
          strokeWidth="1.5"
          strokeDasharray="10 15"
          animate={{ strokeDashoffset: [0, -100] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M 200,600 L 500,450 L 800,700 L 1100,550"
          fill="none"
          stroke="rgba(5, 242, 199, 0.15)"
          strokeWidth="1.5"
          strokeDasharray="8 20"
          animate={{ strokeDashoffset: [0, 100] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
        <circle cx="100" cy="200" r="4" fill="#00F2FE" className="animate-pulse" />
        <circle cx="400" cy="100" r="5" fill="#05F2C7" />
        <circle cx="700" cy="300" r="4" fill="#A78BFA" />
        <circle cx="1000" cy="150" r="5" fill="#00F2FE" />
        <circle cx="500" cy="450" r="6" fill="#FF3366" />
        <circle cx="500" cy="450" r="3" fill="#050507" />
      </svg>
    </div>
  );
}

/* ─── Cyber Threat Live Intercepts Ticker ─── */
const TICKER_MESSAGES = [
  "🚨 INTRUSION INTERCEPTED: Brute-force credentials block on primary authentication node — Identity Shield Active",
  "🛡️ CORE MONITOR: 14,029 newly indexed RedLine Stealer database dump records isolated this hour",
  "⚡ LIVE BREACH: Discord Paste dump scanned (3.2m lines) — matched 12 monitored Enclave user profiles",
  "🔍 DEEP SCANNER: Multi-frame audio deepfake forensic analysis match successful on profile template",
  "🛡️ SYSTEM: Automatic blast radius password-reuse safety sweep deployed to 2,400 active vaults",
];

function CyberThreatTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % TICKER_MESSAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-[#030406]/95 border-b border-white/[0.04] py-2.5 px-4 flex items-center justify-center relative overflow-hidden z-40">
      <div className="absolute left-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-cyan font-bold hidden md:inline">SYSTEM STATUS</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="font-mono text-[10px] sm:text-xs text-ink-muted text-center tracking-wide max-w-2xl px-12 truncate"
        >
          {TICKER_MESSAGES[index]}
        </motion.div>
      </AnimatePresence>

      <div className="absolute right-4 font-mono text-[9px] text-ink-faint hidden md:inline">
        AES-256 COMPLIANT // ONLINE
      </div>
    </div>
  );
}

/* ─── Ambient background layers ─── */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <CyberNetwork />
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
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-[#C5A880] focus:text-black focus:px-4 focus:py-2">Skip to content</a>

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
              ? "border-[rgba(229,213,192,0.08)] bg-[rgba(20,20,23,0.75)] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8)]"
              : "border-transparent bg-transparent"
          }`}
        >
          <a href="#" className="flex items-center gap-2.5" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A880]/25 bg-gradient-to-br from-[#C5A880]/15 to-transparent">
              <Shield className="h-4 w-4 text-[#C5A880]" aria-hidden="true" />
            </div>
            <span className="font-serif text-lg font-medium tracking-tight" style={{ letterSpacing: "-0.01em", fontFamily: "'Playfair Display', Georgia, serif" }}>Enclave</span>
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
              className="hidden px-4 py-2 text-sm text-[var(--tk-ink-muted)] transition-all duration-300 ease-out hover:text-[var(--tk-ink)] md:block"
            >
              Sign in
            </button>
            <button
              onClick={handleGetStarted}
              className="group relative inline-flex items-center gap-2 rounded-lg border border-[#C5A880]/30 bg-gradient-to-r from-[#C5A880]/10 to-transparent px-4 py-2 text-sm font-medium text-[#F4F3F0] transition-all duration-300 ease-out hover:border-[#C5A880]/60 active:scale-[0.98]"
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
        <CyberThreatTicker />
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
              <div className="inline-flex items-center gap-2 rounded-full border border-[#C5A880]/25 bg-[#C5A880]/[0.06] px-4 py-1.5 text-xs font-medium tracking-wide text-[#E5D5C0]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C5A880] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C5A880]" />
                </span>
                Barrier Intelligence · Continuous Threat Sweeps
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
              className="mt-8 text-center font-serif text-5xl font-light leading-[1.08] tracking-tight md:text-7xl lg:text-[5.5rem]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Every account behind a{" "}
              <span className={G_TEXT}>shield</span>.
              <br />
              <span className="text-[var(--tk-ink-muted)]">Breaches can&apos;t spread what we contain.</span>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-[var(--tk-ink-muted)] md:text-xl font-light"
            >
              Enclave secures your digital identity against compromised records and live infostealer logs. 
              We calculate exploitability, map the blast radius of exposed credentials, and deploy real-time playbooks 
              to isolate compromises before they spread.
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
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#C5A880] px-8 py-3.5 text-base font-semibold text-black transition-all duration-300 ease-out hover:shadow-[0_0_40px_rgba(197,168,128,0.25)] active:scale-[0.98]"
              >
                Create secure vault
                <ArrowRight className="h-5 w-5 transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden="true" />
              </button>
              <a href="#how-it-works">
                <button className="inline-flex items-center gap-2 rounded-xl border border-[rgba(229,213,192,0.12)] bg-[rgba(20,20,23,0.6)] px-8 py-3.5 text-base text-[var(--tk-ink)] backdrop-blur-md transition-all duration-300 ease-out hover:border-[rgba(229,213,192,0.25)] hover:bg-[rgba(26,26,30,0.8)] active:scale-[0.98]">
                  How it works
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
              No credit card required · Free forever shield · 3 watched accounts
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
                  Join <span className="font-medium text-[var(--tk-ink)]">2,400+</span> people shielding their accounts
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
                      { label: "Shield", icon: Shield },
                      { label: "Intelligence", icon: Network },
                      { label: "Lockdowns", icon: Siren },
                      { label: "Alerts", icon: Bell },
                      { label: "Deepfake Scan", icon: ScanSearch },
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
                        <span className="text-xs font-medium text-[#7bf7dc]">Active · last sweep 6h</span>
                      </div>
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="col-span-12 md:col-span-9 p-5">
                    {/* Stats row */}
                    <div className="mb-5 grid grid-cols-3 gap-3">
                      {[
                        { label: "WATCHED ACCOUNTS", value: "128", color: "#00F2FE" },
                        { label: "EXPOSED", value: "3", color: "#FF3366" },
                        { label: "LOCKDOWN PLAYBOOKS", value: "1", color: "#05F2C7" },
                      ].map((s) => (
                        <div key={s.label} className={`${CARD} ${CARD_SURFACE} p-3.5`} style={{ willChange: "none" }}>
                          <p className="text-[10px] font-mono tracking-wide text-[var(--tk-ink-faint)]">{s.label}</p>
                          <p className="mt-1 font-mono text-2xl font-semibold" style={{ color: s.color }}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recent findings */}
                    <div className="space-y-2">
                      {[
                        { icon: Radar, title: "Breach found", detail: "Steam password in 1.2B+ pwned corpus — Exploitability 78/100", status: "Breached", accent: "coral" },
                        { icon: ShieldAlert, title: "Stealer log capture", detail: "gmail — captured by infostealer malware on an infected machine", status: "High", accent: "coral" },
                        { icon: Network, title: "Blast radius", detail: "Breached password shards to 2 more accounts (PayPal, Discord)", status: "Contaminated", accent: "violet" },
                        { icon: Siren, title: "Containment playbook", detail: "Lockdown initiated — rotate password, enable 2FA, revoke sessions", status: "In progress", accent: "cyan" },
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
        {/* INTERACTIVE REVENUE-GENERATING RISK ANALYZER TOOL       */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section className="relative px-4 py-16 border-t border-b border-white/[0.04] bg-[#06070a]/40">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center md:text-left">
              <p className="mb-2 text-xs font-mono uppercase tracking-[0.2em] text-[#00F2FE]">Clearance Tool</p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
                Check your exposure index.
              </h2>
              <p className="mt-2 text-sm text-[var(--tk-ink-muted)] max-w-xl">
                Simulate your exploitability based on account density and security practices. See why proactive isolation pays off.
              </p>
            </div>

            <RiskAnalyzer onGetStarted={handleGetStarted} />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* INTERACTIVE PROTECTION SANDBOX LAB                      */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ProtectionSandbox onGetStarted={handleGetStarted} />

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
                      {f.visual === "shield" && (
                        <div className="mt-6 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                          <div>
                            <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>
                            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--tk-ink-muted)]">{f.desc}</p>
                            <ul className="mt-4 space-y-2">
                              {[
                                { icon: KeyRound, label: "Encrypted credential vault", val: "256-bit" },
                                { icon: Radar, label: "Stealer logs + 1.2B breach corpus", val: "6h sweep" },
                                { icon: Network, label: "Blast-radius contamination map", val: "live" },
                                { icon: Siren, label: "Lockdown playbooks on every account", val: "1-tap" },
                              ].map((row) => (
                                <li key={row.label} className="flex items-center gap-2.5 text-[13px] text-[var(--tk-ink-muted)]">
                                  <row.icon className="h-3.5 w-3.5 text-[#00F2FE]" aria-hidden="true" />
                                  {row.label}
                                  <span className="ml-auto font-mono text-[11px] text-[#7FEFFF]">{row.val}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <Ring value={f.ringValue ?? 94} size={132} color="#00F2FE" />
                        </div>
                      )}

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
                              <span className="text-[10px] font-mono text-[var(--tk-ink-faint)]">BREACH + LIVE STEALER FEED</span>
                              <span className="text-[10px] font-mono text-[#05F2C7]">+38 this sweep</span>
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
                              { label: "Lockdown · rotate Steam password", t: "2m", color: "#FF3366" },
                              { label: "Lockdown · enable 2FA on Google", t: "4m", color: "#FF3366" },
                              { label: "Containment complete · 3 accounts sealed", t: "6m", color: "#05F2C7" },
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
                Three steps behind the shield
              </h2>
              <p className="mt-4 text-lg text-[var(--tk-ink-muted)]">No setup wizard. No 30-minute onboarding.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { step: "01", title: "Watch your accounts", desc: "Add the email, banking, social, and gaming accounts that hold your identity. Vault their credentials — encrypted, never shown, only scored. Your shield is live in seconds.", icon: Users },
                { step: "02", title: "The shield sweeps 24/7", desc: "A 6-hour auto-sweep re-checks every account against 1.2B+ breached records and live infostealer logs, scores exploitability, and maps the blast radius of reused passwords.", icon: Radar },
                { step: "03", title: "Contain the blast", desc: "One tap opens a lockdown playbook on every affected account — rotate the password, enable 2FA, revoke sessions — so a single leak can never cascade.", icon: Siren },
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
        {/* BARRIER INTELLIGENCE — the flagship deep dive            */}
        {/* ═══════════════════════════════════════════════════════ */}
        <section className="relative px-4 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[#7FEFFF]">The flagship</p>
              <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                Barrier Intelligence
                <br />
                <span className="text-[var(--tk-ink-muted)]">not a breach checker. A barrier.</span>
              </h2>
              <p className="mt-4 text-lg text-[var(--tk-ink-muted)]">
                Checkers tell you something leaked. A barrier tells you what it can reach next — and stops it.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Contamination graph mock */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={`${CARD} ${CARD_SURFACE} relative overflow-hidden p-6 md:p-8`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--tk-ink-faint)]">Blast radius</p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">One leak, traced end-to-end</h3>
                  </div>
                  <span className="rounded-full border border-[#FF3366]/25 bg-[#FF3366]/10 px-2.5 py-0.5 font-mono text-[11px] text-[#FF3366]">REUSED PASSWORD</span>
                </div>

                <div className="relative mt-8 aspect-[4/3]">
                  <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden>
                    <defs>
                      <linearGradient id="edge" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FF3366" />
                        <stop offset="100%" stopColor="#00F2FE" />
                      </linearGradient>
                    </defs>
                    {[
                      { x1: 200, y1: 60, x2: 60, y2: 200 },
                      { x1: 200, y1: 60, x2: 340, y2: 200 },
                      { x1: 200, y1: 60, x2: 200, y2: 240 },
                      { x1: 60, y1: 200, x2: 200, y2: 240 },
                    ].map((e, i) => (
                      <line
                        key={i}
                        x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                        stroke={i === 0 ? "#00F2FE" : "url(#edge)"}
                        strokeWidth="1.5"
                        strokeOpacity="0.5"
                        strokeDasharray={i === 0 ? "0" : "5 5"}
                      />
                    ))}
                    {/* Breached origin */}
                    <g>
                      <circle cx="200" cy="60" r="30" fill="rgba(255,51,102,0.14)" stroke="#FF3366" strokeWidth="2" />
                      <text x="200" y="56" textAnchor="middle" fill="#FF3366" fontSize="26">⚠</text>
                      <text x="200" y="112" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="600">PayPal · 78/100</text>
                      <text x="200" y="128" textAnchor="middle" fill="#9BA3B2" fontSize="11">breached</text>
                    </g>
                    {[
                      { x: 60, y: 200, label: "Google", sub: "contaminated", color: "#A78BFA" },
                      { x: 340, y: 200, label: "Steam", sub: "contaminated", color: "#A78BFA" },
                      { x: 200, y: 240, label: "Discord", sub: "clear", color: "#05F2C7" },
                    ].map((n, i) => (
                      <g key={i}>
                        <circle cx={n.x} cy={n.y} r="26" fill={n.sub === "clear" ? "rgba(5,242,199,0.08)" : "rgba(167,139,250,0.14)"} stroke={n.color} strokeWidth="1.5" />
                        <text x={n.x} y={n.y + 4} textAnchor="middle" fill={n.color} fontSize="11" fontWeight="600">{n.label}</text>
                        <text x={n.x} y={n.y + 46} textAnchor="middle" fill={n.sub === "clear" ? "#05F2C7" : "#A78BFA"} fontSize="10" fontFamily="monospace">{n.sub.toUpperCase()}</text>
                      </g>
                    ))}
                  </svg>
                  <div className="pointer-events-none absolute -bottom-2 left-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,13,0.9)] px-3 py-1.5 font-mono text-[11px] text-[#7FEFFF]">
                    blast_radius: 2 · edges: 2 · contamination_linked
                  </div>
                </div>
              </motion.div>

              {/* Explainers */}
              <div className="grid gap-4">
                {[
                  {
                    icon: Radar,
                    title: "Live infostealer feed",
                    body: "Hudson Rock's stealer-log corpus is queried by your identifier on every sweep. If malware on an infected machine captured your email, the shield knows which services an attacker can reach — and assumes anything reused is compromised.",
                    chip: "STEALER_LOG · LIVE",
                    color: "coral",
                  },
                  {
                    icon: Gauge,
                    title: "Exploitability score",
                    body: "Every account is scored 0–100 from breach status, pwned-password count, credential strength, 2FA, password reuse, and contamination. High-exposure accounts surface first with an attacker path you can read, not a red blob.",
                    chip: "0-100 · ARCHIVED",
                    color: "cyan",
                  },
                  {
                    icon: Siren,
                    title: "Contain-all lockdown",
                    body: "Breached or at-risk accounts get a playbook: where to rotate the password, toggling 2FA, revoking active sessions, recovery fallbacks. One tap opens them across every member of the blast radius.",
                    chip: "PLAYBOOK · 1-TAP",
                    color: "teal",
                  },
                  {
                    icon: TimerReset,
                    title: "6-hour auto-sweep",
                    body: "The shield never stops re-checking. New breach dumps and stealer captures surface on a scheduled sweep — no manual scans, no 'checked last month' gaps. Free accounts sweep on demand; Pro+ sweeps automatically.",
                    chip: "AUTO · EVERY 6H",
                    color: "violet",
                  },
                ].map((card, i) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
                    className={`${CARD} ${CARD_SURFACE} ${CARD_HOVER} group flex gap-4 p-5`}
                  >
                    <div className={`shrink-0 rounded-xl border p-2.5 ${ACCENT[card.color as keyof typeof ACCENT].chip}`}>
                      <card.icon className={`h-5 w-5 ${ACCENT[card.color as keyof typeof ACCENT].text}`} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold tracking-tight">{card.title}</h3>
                        <span className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--tk-ink-faint)]">{card.chip}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--tk-ink-muted)]">{card.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
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
                Start behind the shield.
                <br />
                Widen the wall when you need it.
              </h2>
              <p className="mt-4 text-lg text-[var(--tk-ink-muted)]">Every plan is a real shield. Bigger plans watch more and act faster. No card required to begin.</p>
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
                  <div className={`mt-3 rounded-lg border px-2.5 py-1.5 text-center font-mono text-[11px] ${tier.popular ? "border-[#00F2FE]/25 bg-[#00F2FE]/[0.06] text-[#7FEFFF]" : "border-[rgba(255,255,255,0.07)] bg-white/[0.02] text-[var(--tk-ink-muted)]"}`}>
                    {tier.watch}
                  </div>
                  <ul className="mt-4 space-y-2">
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
                  Put your accounts <span className={G_TEXT}>behind the shield</span>
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--tk-ink-muted)]">
                  Free to start. No credit card required. Three accounts, breach + stealer checks, an encrypted vault — your barrier is up in seconds.
                </p>
                <button
                  onClick={handleGetStarted}
                  className="group mt-9 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] via-[#05F2C7] to-[#00F2FE] px-10 py-4 text-base font-semibold text-black transition-all duration-300 ease-out hover:shadow-[0_0_45px_rgba(0,242,254,0.45)] active:scale-[0.98]"
                >
                  Build my shield for free
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
                  Breach monitoring, live stealer-log intelligence, and containment for every account you care about. Built on real corpus data — not marketing.
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

/* ─────────────────────────────────────────────────────────
   INTERACTIVE PROTECTION SANDBOX SIMULATOR (FUN & REVENUE)
   ───────────────────────────────────────────────────────── */
function ProtectionSandbox({ onGetStarted }: { onGetStarted: () => void }) {
  const [switches, setSwitches] = useState({
    decoy: false,
    scrambler: false,
    crawler: false,
    sandbox: false,
  });

  const [loading, setLoading] = useState(false);

  const toggleSwitch = (key: keyof typeof switches) => {
    setLoading(true);
    setSwitches(prev => ({ ...prev, [key]: !prev[key] }));
    setTimeout(() => {
      setLoading(false);
    }, 300);
  };

  const countActive = Object.values(switches).filter(Boolean).length;
  const grade = countActive === 0 ? "F" : countActive === 1 ? "C" : countActive === 2 ? "B" : countActive === 3 ? "A" : "S++ (IMMUNE)";
  const gradeColor = countActive === 0 ? "#FF3366" : countActive === 1 ? "#EAB308" : countActive === 2 ? "#3B82F6" : countActive === 3 ? "#05F2C7" : "#00F2FE";

  return (
    <section className="relative px-4 py-20 border-b border-white/[0.04] bg-[#030406]/60">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center md:text-left">
          <p className="mb-2 text-xs font-mono uppercase tracking-[0.2em] text-[#05F2C7]">Defense Lab</p>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl text-[#F4F7FB]">
            Interactive Identity Protection Sandbox
          </h2>
          <p className="mt-2 text-sm text-[var(--tk-ink-muted)] max-w-xl">
            Toggle Enclave's advanced active defense modules in real-time. Experience how sandbox isolation creates a bulletproof digital barrier.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-12 rounded-2xl border border-white/[0.06] bg-[#050608]/90 p-6 sm:p-8 relative overflow-hidden backdrop-blur-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]">
          {/* Controls */}
          <div className="md:col-span-7 space-y-4 text-left">
            {[
              { id: "decoy", label: "📸 Camera Immunizer & Decoy Matrix", desc: "Injects sub-perceptual cryptographic noise into local JPEG headers to scramble facial recognition scrapers", color: "cyan" },
              { id: "scrambler", label: "🎙️ Ambient Voice Scrambler Shield", desc: "Runs low-latency micro-frequency background acoustic scrambling to block biometric vocal cloning software", color: "teal" },
              { id: "crawler", label: "🕵️ Active Dark Web Forum Crawler", desc: "Launches automated distributed crawler scripts across major darknet marketplaces and onion forums", color: "coral" },
              { id: "sandbox", label: "📦 Floating Sandbox App Isolation", desc: "Wraps overlay plugins in hardened sandboxed processes to block malware visual tap-jacking scripts", color: "violet" },
            ].map((module) => {
              const active = switches[module.id as keyof typeof switches];
              return (
                <div
                  key={module.id}
                  onClick={() => toggleSwitch(module.id as keyof typeof switches)}
                  className={`group cursor-pointer rounded-xl border p-4 transition-all duration-300 flex items-center justify-between ${
                    active
                      ? "border-cyan/30 bg-cyan/[0.04] shadow-[0_0_15px_rgba(0,242,254,0.04)]"
                      : "border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="space-y-1 pr-6">
                    <span className={`text-sm font-semibold transition-colors duration-200 ${active ? "text-cyan" : "text-ink"}`}>{module.label}</span>
                    <p className="text-xs text-ink-faint leading-relaxed">{module.desc}</p>
                  </div>
                  {/* Neon Switch slider */}
                  <div className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 shrink-0 ${active ? "bg-cyan" : "bg-white/[0.08]"}`}>
                    <div className={`h-5 w-5 rounded-full bg-black shadow-md transform transition-all duration-300 ${active ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visualization Terminal */}
          <div className="md:col-span-5 flex flex-col justify-between rounded-xl border border-white/[0.06] bg-[#020304] p-6 relative overflow-hidden text-center min-h-[360px]">
            {/* Holographic scanning overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,242,199,0.03),transparent_70%)] pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#05F2C7]/30 to-transparent animate-pulse" />

            <div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint block">
                {loading ? "⚡ SYNCING VAULT NODES..." : "LIVE METRIC OVERVIEW"}
              </span>
              
              <div className="relative mx-auto my-6 flex h-32 w-32 items-center justify-center rounded-full border border-white/[0.04] bg-[#030405] shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                {/* Circular glowing progression meter */}
                <svg className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="4" />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke={gradeColor}
                    strokeWidth="4"
                    strokeDasharray={351.8}
                    strokeDashoffset={351.8 - (351.8 * (countActive * 25)) / 100}
                    style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
                  />
                </svg>

                <div className="flex flex-col items-center justify-center z-10">
                  <span className="font-mono text-xs text-ink-faint uppercase font-semibold">SECURITY GRADE</span>
                  <span className="font-mono text-3xl font-black mt-1 leading-none tracking-tight transition-all duration-300" style={{ color: gradeColor }}>
                    {grade}
                  </span>
                  <span className="font-mono text-[9px] text-[#05F2C7] mt-1.5 font-bold animate-pulse">
                    {countActive * 25}% COVERAGE
                  </span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase border border-white/[0.08] bg-white/[0.02] text-ink-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${countActive > 0 ? "animate-pulse" : "bg-red"}`} style={{ backgroundColor: gradeColor }} />
                SHIELD SYSTEM: {countActive === 0 ? "DEFENSELESS" : countActive === 4 ? "FULLY IMMUNE" : "ACTIVE MONITORING"}
              </div>

              <p className="mt-4 text-xs text-ink-muted leading-relaxed">
                {countActive === 0 
                  ? "⚠️ All protection modules are offline. Your digital footprint remains exposed to live stealer sweepers and scraping crawlers." 
                  : countActive < 4 
                  ? "🛡️ Shield is partially deployed. Your clearance rating is elevated, but sandbox isolation is required to prevent visual injection hacks." 
                  : "🔥 MAXIMUM IMMUNITY ENGAGED! Decoy matrices, voice scrambling, sandboxes, and active darknet crawling are active in a unified defense loop."}
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-white/[0.06] space-y-3">
              <button
                onClick={onGetStarted}
                className="w-full rounded-xl bg-gradient-to-r from-[#00F2FE] via-[#05F2C7] to-[#00F2FE] py-3 text-sm font-bold text-black shadow-[0_0_24px_rgba(0,242,254,0.25)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(0,242,254,0.45)]"
              >
                Activate Permanent Vault Shield
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   INTERACTIVE SECURITY RISK ANALYZER (CONVERSION DRIVER)
   ───────────────────────────────────────────────────────── */
interface ServiceType {
  id: string;
  label: string;
  weight: number;
}

const SECTOR_TYPES: ServiceType[] = [
  { id: "fin", label: "💸 Banking & Finance", weight: 20 },
  { id: "email", label: "📧 Personal & Work Email", weight: 25 },
  { id: "social", label: "📱 Social Media Profiles", weight: 12 },
  { id: "cloud", label: "☁️ Cloud Storage (Docs/Photos)", weight: 18 },
  { id: "work", label: "💼 Professional SaaS & VPNs", weight: 15 },
  { id: "gaming", label: "🎮 Gaming & Entertainment", weight: 8 },
];

function RiskAnalyzer({ onGetStarted }: { onGetStarted: () => void }) {
  const [accountCount, setAccountCount] = useState(12);
  const [passwordReuse, setPasswordReuse] = useState(true);
  const [selectedSectors, setSelectedSectors] = useState<string[]>(["fin", "email", "social"]);
  const [analyzing, setAnalyzing] = useState(false);

  // Toggle selected categories
  const toggleSector = (id: string) => {
    setSelectedSectors((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Dynamic score calculator
  const baseVulnerability = selectedSectors.reduce((total, id) => {
    const s = SECTOR_TYPES.find((item) => item.id === id);
    return total + (s ? s.weight : 0);
  }, 0);

  const reuseMultiplier = passwordReuse ? 1.6 : 1.0;
  const quantityWeight = Math.min(20, accountCount * 0.8);
  const finalScore = Math.min(99, Math.round((baseVulnerability + quantityWeight) * reuseMultiplier));

  const riskLabel = finalScore < 30 ? "SAFE" : finalScore < 65 ? "ELEVATED" : "CRITICAL";
  const riskColor = finalScore < 30 ? "#05F2C7" : finalScore < 65 ? "#EAB308" : "#FF3366";

  const triggerAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
    }, 850);
  };

  return (
    <div className="grid gap-6 md:grid-cols-12 rounded-2xl border border-white/[0.06] bg-[#090a10]/80 p-6 sm:p-8 backdrop-blur-2xl">
      {/* Parameters Panel */}
      <div className="md:col-span-7 space-y-6 text-left">
        {/* Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-ink">Estimated Active Accounts</span>
            <span className="font-mono text-xs font-bold text-cyan bg-cyan/10 px-2 py-0.5 rounded-md border border-cyan/20">
              {accountCount} Channels
            </span>
          </div>
          <input
            type="range"
            min="3"
            max="80"
            value={accountCount}
            onChange={(e) => {
              setAccountCount(parseInt(e.target.value));
              triggerAnalyze();
            }}
            className="w-full h-1 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-cyan"
          />
          <p className="text-[10px] text-ink-faint font-mono uppercase">Includes streaming, shopping, SaaS, banking & work platforms</p>
        </div>

        {/* Sectors checklist */}
        <div className="space-y-3">
          <span className="text-sm font-semibold text-ink block">Select Asset Types Under Shield</span>
          <div className="grid grid-cols-2 gap-2">
            {SECTOR_TYPES.map((sec) => {
              const active = selectedSectors.includes(sec.id);
              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    toggleSector(sec.id);
                    triggerAnalyze();
                  }}
                  className={`flex items-center text-left px-3 py-2.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
                    active
                      ? "border-cyan/35 bg-cyan/10 text-cyan shadow-[0_0_12px_rgba(0,242,254,0.06)]"
                      : "border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] text-ink-muted"
                  }`}
                >
                  {sec.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Habit selector */}
        <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-ink block">Reused Decryption Key Habit</span>
              <p className="text-[11px] text-ink-muted leading-snug">Do you share or reuse passwords across multiple services?</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setPasswordReuse(true);
                  triggerAnalyze();
                }}
                className={`px-3 py-1.5 rounded-lg font-mono text-[10px] tracking-wider uppercase border font-bold transition-all ${
                  passwordReuse
                    ? "bg-red/15 text-red border-red/30 shadow-[0_0_10px_rgba(255,51,102,0.15)]"
                    : "bg-transparent text-ink-faint border-white/[0.06] hover:bg-white/[0.03]"
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => {
                  setPasswordReuse(false);
                  triggerAnalyze();
                }}
                className={`px-3 py-1.5 rounded-lg font-mono text-[10px] tracking-wider uppercase border font-bold transition-all ${
                  !passwordReuse
                    ? "bg-green/15 text-green border-green/30 shadow-[0_0_10px_rgba(5,242,199,0.15)]"
                    : "bg-transparent text-ink-faint border-white/[0.06] hover:bg-white/[0.03]"
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Display */}
      <div className="md:col-span-5 flex flex-col justify-between rounded-xl border border-white/[0.06] bg-[#050608] p-5 sm:p-6 text-center relative overflow-hidden">
        {/* Scanning Glow Overlay */}
        <AnimatePresence>
          {analyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-cyan/[0.02] flex items-center justify-center z-10 backdrop-blur-[1px]"
            >
              <div className="absolute top-0 inset-x-0 h-[2px] bg-cyan shadow-[0_0_10px_#00F2FE]" />
              <div className="flex items-center gap-1.5 font-mono text-xs text-cyan">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating Threat Index...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint block">CALCULATED THREAT VECTOR</span>
          
          {/* Main big dial mockup */}
          <div className="relative mx-auto my-5 flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-white/[0.06]">
            {/* Pulsing ring indicator */}
            <div className="absolute inset-2 rounded-full border border-dotted border-white/[0.08]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-4xl font-black tracking-tight" style={{ color: riskColor }}>
                {finalScore}%
              </span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-ink-faint mt-0.5">EXPOSURE SCORE</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase border"
            style={{
              borderColor: `${riskColor}30`,
              backgroundColor: `${riskColor}10`,
              color: riskColor,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: riskColor }} />
            {riskLabel} CLEARANCE INDEX
          </div>

          <p className="mt-4 text-xs text-ink-muted leading-relaxed">
            {passwordReuse 
              ? "🚨 Shared passwords generate a severe blast radius multiplier. Any simple breach instantly jeopardizes all connected financial & personal dashboards." 
              : "🛡️ Isolated passwords offer solid static security, but credential dumps and live browser logs still present a continuous exposure threat."}
          </p>
        </div>

        <div className="mt-6 pt-5 border-t border-white/[0.06] space-y-3">
          <div className="flex justify-between font-mono text-[10px] text-ink-faint uppercase">
            <span>Blast Radius Potential</span>
            <span className="text-ink font-bold">{passwordReuse ? "Severe Risk (3.2x)" : "Moderate (1.0x)"}</span>
          </div>
          <button
            onClick={onGetStarted}
            className="w-full rounded-xl bg-gradient-to-r from-[#00F2FE] via-[#05F2C7] to-[#00F2FE] py-3 text-sm font-bold text-black shadow-[0_0_24px_rgba(0,242,254,0.25)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(0,242,254,0.45)]"
          >
            Claim Pro Guard & Shield Up
          </button>
        </div>
      </div>
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
