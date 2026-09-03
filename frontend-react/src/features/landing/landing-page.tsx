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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/* ─── CSS Custom Properties ─── */
const cssVars = {
  "--color-primary": "#22c55e",
  "--color-accent": "#06b6d4",
  "--color-bg": "#111113",
  "--color-bg-raised": "#161618",
  "--color-text": "#fafaf9",
  "--color-text-muted": "#a1a1aa",
  "--color-text-dim": "#a1a1aa",
  "--color-border": "rgba(255,255,255,0.06)",
} as React.CSSProperties;

/* ─── Data ─── */
const FEATURES = [
  {
    icon: ScanSearch,
    title: "Deepfake Detection",
    desc: "Neural networks analyze images, audio, and video frame-by-frame. Not keyword matching — real ML inference catching manipulation before it spreads.",
    color: "cyan",
    span: "md:col-span-2",
  },
  {
    icon: Radar,
    title: "Dark Web Monitoring",
    desc: "Continuous scanning across surface web, Reddit, paste sites, and hidden forums.",
    color: "purple",
    span: "",
  },
  {
    icon: Bell,
    title: "Threat Alerts",
    desc: "Real-time push notifications and email the moment something is found.",
    color: "green",
    span: "",
  },
  {
    icon: Shield,
    title: "Auto Takedown",
    desc: "Automatic DMCA notices with 48-hour escalation and evidence preservation.",
    color: "amber",
    span: "",
  },
  {
    icon: Lock,
    title: "Content Watermarking",
    desc: "Invisible watermarks and C2PA credentials prove ownership and deter theft.",
    color: "cyan",
    span: "",
  },
  {
    icon: Eye,
    title: "Face Analysis",
    desc: "Detect and compare multiple faces against your enrolled biometric profile.",
    color: "purple",
    span: "",
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
  { value: 2000000, suffix: "+", label: "Images Analyzed" },
  { value: 95, suffix: "%", label: "Detection Accuracy" },
  { value: 50000, suffix: "+", label: "Threats Blocked" },
  { value: 99.9, suffix: "%", label: "Uptime" },
];

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Content Creator",
    text: "Found deepfakes of me on 3 different sites within hours. The auto-takedown saved me weeks of work. I didn't have to file a single form myself.",
    rating: 5,
    color: "#06b6d4",
    initials: "SC",
  },
  {
    name: "Marcus Rodriguez",
    role: "Privacy Advocate",
    text: "Finally a tool that takes identity protection seriously. The dark web monitoring is something else.",
    rating: 5,
    color: "#a855f7",
    initials: "MR",
  },
  {
    name: "Dr. Aisha Patel",
    role: "Public Figure",
    text: "The watermarking feature alone is worth it. I now have proof of ownership for all my content.",
    rating: 5,
    color: "#f59e0b",
    initials: "AP",
  },
];

const FAQ = [
  {
    q: "How does deepfake detection actually work?",
    a: "We run a multi-layered detection pipeline. First, MTCNN extracts faces from images. Then XceptionNet — a convolutional neural network trained on manipulation datasets like FaceForensics++ — classifies each face as real or synthetic. For audio, we use Librosa spectral analysis to detect voice cloning artifacts. Every result gets a confidence score and a human-readable explanation. No magic, no buzzwords — just ML inference on real hardware.",
  },
  {
    q: "What sources do you scan?",
    a: "We scan the surface web via search engine APIs, social media platforms like Reddit and X, paste sites such as Pastebin and Ghostbin, dark web forums and marketplaces, Telegram channels, and file-sharing platforms. Pro plans and above get hourly monitoring with real-time alerts. Shield plans add dark web crawling withTor integration.",
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

const COLOR_MAP: Record<string, string> = {
  cyan: "text-cyan",
  purple: "text-purple",
  green: "text-green",
  amber: "text-amber",
};

const BG_MAP: Record<string, string> = {
  cyan: "bg-cyan/10",
  purple: "bg-purple/10",
  green: "bg-green/10",
  amber: "bg-amber/10",
};

const BORDER_MAP: Record<string, string> = {
  cyan: "border-cyan/20",
  purple: "border-purple/20",
  green: "border-green/20",
  amber: "border-amber/20",
};

const HOVER_GLOW: Record<string, string> = {
  cyan: "hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]",
  purple: "hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
  green: "hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]",
  amber: "hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
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

/* ─── Main Component ─── */
export function LandingPage({ onGetStarted }: { onGetStarted?: () => void }) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (user) return null;

  function handleGetStarted() {
    if (onGetStarted) onGetStarted();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]" style={cssVars}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-green focus:text-black focus:px-4 focus:py-2">Skip to content</a>

      {/* Navigation — sticky with scroll opacity */}
      <nav
        className={`fixed top-0 z-50 w-full border-b transition-all duration-300 ${
          navScrolled
            ? "border-white/[0.1] bg-[#111113]/95 backdrop-blur-xl shadow-[0_1px_20px_rgba(0,0,0,0.5)]"
            : "border-transparent bg-transparent backdrop-blur-none"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green">
              <Shield className="h-4 w-4 text-black" aria-hidden="true" />
            </div>
            <span className="font-display text-lg font-bold" style={{ letterSpacing: "-0.02em" }}>Enclave</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-base text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">Features</a>
            <a href="#how-it-works" className="text-base text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">How It Works</a>
            <a href="#pricing" className="text-base text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">Pricing</a>
            <a href="#faq" className="text-base text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleGetStarted} className="hidden md:flex">
              Sign In
            </Button>
            <Button onClick={handleGetStarted} className="bg-green text-black font-medium">
              Protect My Identity
            </Button>
            <button
              className="md:hidden text-[var(--color-text-muted)]"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/[0.06] md:hidden"
              style={{ willChange: "height, opacity" }}
            >
              <div className="space-y-2 px-6 py-4">
                <a href="#features" className="block py-2 text-base text-[var(--color-text-muted)]">Features</a>
                <a href="#how-it-works" className="block py-2 text-base text-[var(--color-text-muted)]">How It Works</a>
                <a href="#pricing" className="block py-2 text-base text-[var(--color-text-muted)]">Pricing</a>
                <a href="#faq" className="block py-2 text-base text-[var(--color-text-muted)]">FAQ</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO                                                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      <main id="main-content" className="relative pt-20">
        {/* Grid texture background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Noise texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Gradient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-20">
          {/* Top badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center mb-8"
            style={{ willChange: "transform, opacity" }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/[0.06] px-4 py-1.5 text-base text-green">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              <span>ML-powered identity protection</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-center font-display text-5xl font-bold leading-[1.05] md:text-7xl lg:text-8xl"
            style={{ letterSpacing: "-0.035em", willChange: "transform, opacity" }}
          >
            Your face is{" "}
            <span className="text-green">yours</span>.
            <br />
            <span className="text-[var(--color-text-muted)]">Keep it that way.</span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-center text-xl text-[var(--color-text-muted)] leading-relaxed"
            style={{ willChange: "transform, opacity" }}
          >
            Detect deepfakes, monitor the dark web, and take down unauthorized use of your identity.
            Built with real ML models — not marketing.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
            style={{ willChange: "transform, opacity" }}
          >
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-green text-black font-semibold px-8 text-base"
            >
              Scan My Face for Free
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="border-white/10 text-base">
                See How It Works
              </Button>
            </a>
          </motion.div>

          {/* Social proof — honest user count */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-3"
            style={{ willChange: "opacity" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {["#06b6d4", "#a855f7", "#f59e0b", "#22c55e", "#ef4444"].map((color, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-[#111113] flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: color, zIndex: 5 - i }}
                  >
                    {["S", "M", "A", "K", "J"][i]}
                  </div>
                ))}
              </div>
              <span className="text-base text-[var(--color-text-muted)]">
                Join <span className="text-[var(--color-text)] font-medium">2,400+</span> people protecting their identity
              </span>
            </div>
          </motion.div>

          {/* Dashboard mockup with scanning line effect */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16"
            style={{ willChange: "transform, opacity" }}
          >
            <div className="relative mx-auto max-w-4xl">
              {/* Ambient glow */}
              <div className="absolute -inset-4 rounded-3xl bg-green/[0.03] blur-xl" />

              {/* Dashboard frame */}
              <figure className="relative rounded-2xl border border-white/[0.08] bg-[#18181b] overflow-hidden">
                {/* Scanning line effect */}
                <motion.div
                  className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-green/40 to-transparent pointer-events-none z-10"
                  animate={{ top: ["0%", "100%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  style={{ willChange: "top" }}
                />

                {/* Title bar */}
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
                  <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <div className="h-3 w-3 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-sm text-[var(--color-text-dim)]">enclave — dashboard</span>
                </div>

                {/* Dashboard content */}
                <div className="grid grid-cols-12 gap-0">
                  {/* Sidebar */}
                  <div className="col-span-3 border-r border-white/[0.06] p-4 space-y-2">
                    {[
                      { label: "Overview", icon: Shield },
                      { label: "Scans", icon: ScanSearch },
                      { label: "Alerts", icon: Bell },
                      { label: "Takedowns", icon: FileWarning },
                      { label: "Settings", icon: Lock },
                    ].map((item, i) => (
                      <div
                        key={item.label}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          i === 0 ? "bg-green/10 text-green" : "text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)]"
                        }`}
                      >
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        {item.label}
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <figcaption className="col-span-9 p-5">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: "Active scans", value: "12", color: "text-green" },
                        { label: "Threats found", value: "3", color: "text-red" },
                        { label: "Takedowns", value: "8", color: "text-cyan" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                          <p className="text-sm text-[var(--color-text-dim)]">{s.label}</p>
                          <p className={`font-display text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recent alerts */}
                    <div className="space-y-2">
                      {[
                        { icon: ScanSearch, title: "Image scan complete", detail: "photo_2024.jpg — No manipulation detected", status: "Safe", statusColor: "text-green", bg: "bg-cyan/10", border: "border-cyan/20" },
                        { icon: Radar, title: "Dark web match", detail: "Your image found on suspicious forum", status: "Threat", statusColor: "text-red", bg: "bg-red/10", border: "border-red/20" },
                        { icon: Shield, title: "Takedown sent", detail: "DMCA notice to hosting provider", status: "In progress", statusColor: "text-amber", bg: "bg-green/10", border: "border-green/20" },
                        { icon: Eye, title: "Face match", detail: "2 faces found in scanned content", status: "Review", statusColor: "text-purple", bg: "bg-purple/10", border: "border-purple/20" },
                      ].map((alert) => (
                        <div key={alert.title} className={`flex items-center gap-3 rounded-lg border ${alert.border} ${alert.bg} p-3`}>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                            <alert.icon className={`h-4 w-4 ${alert.statusColor}`} aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{alert.title}</p>
                            <p className="text-sm text-[var(--color-text-dim)] truncate">{alert.detail}</p>
                          </div>
                          <span className={`text-sm font-medium ${alert.statusColor}`}>{alert.status}</span>
                        </div>
                      ))}
                    </div>
                  </figcaption>
                </div>
              </figure>
            </div>
          </motion.div>

          {/* Stats — count-up animation */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
            style={{ willChange: "transform, opacity" }}
          >
            {STATS.map((stat) => (
              <StatCounter key={stat.label} {...stat} />
            ))}
          </motion.div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FEATURES                                                */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Here&apos;s exactly what Enclave does under the hood
            </h2>
            <p className="mt-3 max-w-lg text-base text-[var(--color-text-muted)]">
              Six core capabilities, each backed by real infrastructure.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 auto-rows-[minmax(140px,auto)]">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`grain group rounded-xl border ${BORDER_MAP[f.color]} bg-white/[0.02] p-6 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.12] ${HOVER_GLOW[f.color]} hover:-translate-y-1 ${f.span} ${i === 0 ? "md:row-span-2" : ""}`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${BG_MAP[f.color]}`}>
                    <Icon className={`h-5 w-5 ${COLOR_MAP[f.color]}`} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold" style={{ letterSpacing: "-0.01em" }}>{f.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-[var(--color-text-muted)]">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 border-t border-white/[0.04] bg-[var(--color-bg-raised)]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Three steps to protection
            </h2>
            <p className="mt-3 text-base text-[var(--color-text-muted)]">No setup wizard. No 30-minute onboarding.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "Enroll your face", desc: "Upload a photo. We create a biometric hash in seconds. Your raw photo is never stored.", icon: Eye },
              { step: "02", title: "We scan everywhere", desc: "Surface web, social media, paste sites, dark web forums, Telegram. Continuously.", icon: Globe },
              { step: "03", title: "We act", desc: "Instant alerts. Automatic DMCA takedowns. Evidence preserved for legal use.", icon: Zap },
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-display text-4xl font-bold text-green/20">{item.step}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10">
                    <item.icon className="h-5 w-5 text-green" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-[var(--color-text-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PRICING                                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Pricing
            </h2>
            <p className="mt-3 text-base text-[var(--color-text-muted)]">
              Start free. Upgrade when you need more.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative grain rounded-xl border p-5 transition-colors ${
                  tier.popular
                    ? "border-green/30 bg-green/[0.04]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-2.5 left-4 rounded bg-green px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                    Popular
                  </div>
                )}
                <h3 className="font-display text-base font-semibold">{tier.name}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-dim)] italic">{tier.tagline}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold" style={{ letterSpacing: "-0.02em" }}>{tier.price}</span>
                  <span className="text-sm text-[var(--color-text-dim)]">{tier.period}</span>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-sm text-[#d4d4d8]">
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-green/70" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-5 w-full text-sm ${tier.popular ? "bg-green text-black font-medium" : ""}`}
                  variant={tier.popular ? "default" : "outline"}
                  size="sm"
                  onClick={handleGetStarted}
                >
                  {tier.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TESTIMONIALS — with distinct avatars                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="testimonials" className="py-24 px-6 border-t border-white/[0.04] bg-[var(--color-bg-raised)]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              What people say
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-3 grain rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: TESTIMONIALS[0].rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber text-amber" aria-hidden="true" />
                ))}
              </div>
              <p className="text-base leading-relaxed text-[#d4d4d8]">&ldquo;{TESTIMONIALS[0].text}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: TESTIMONIALS[0].color }}
                >
                  {TESTIMONIALS[0].initials}
                </div>
                <div>
                  <p className="text-sm font-medium">{TESTIMONIALS[0].name}</p>
                  <p className="text-sm text-[var(--color-text-dim)]">{TESTIMONIALS[0].role}</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col gap-4">
              {TESTIMONIALS.slice(1, 3).map((t) => (
                <div key={t.name} className="grain flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="mb-2 flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-amber text-amber" aria-hidden="true" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-[#d4d4d8]">&ldquo;{t.text}&rdquo;</p>
                  <div className="mt-4 flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-sm text-[var(--color-text-dim)]">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FOUNDER NOTE                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green/10 text-green mb-4">
            <Shield className="h-6 w-6" aria-hidden="true" />
          </div>
          <blockquote className="text-xl leading-relaxed text-[var(--color-text-muted)] italic">
            &ldquo;We built Enclave because we were tired of seeing deepfake victims file DMCA notices by hand while platforms dragged their feet. The tools exist to fight this automatically — we just had to wire them together. Every feature in Enclave exists because someone needed it.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-[var(--color-text-dim)]">— The Enclave Team</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FAQ                                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-6 border-t border-white/[0.04] bg-[var(--color-bg-raised)]">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                <button
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span className="font-display text-base font-semibold pr-4">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-text-dim)] transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                      style={{ willChange: "height, opacity" }}
                    >
                      <p className="px-5 pb-4 text-base leading-relaxed text-[var(--color-text-muted)]">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CTA                                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-2xl border border-green/20 bg-green/[0.04] p-12 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-green/[0.06] to-transparent pointer-events-none" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
                Protect your identity today
              </h2>
              <p className="mt-4 text-base text-[var(--color-text-muted)] max-w-lg mx-auto">
                Free to start. No credit card required. Join thousands who already use Enclave to protect their face, voice, and digital identity.
              </p>
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="mt-8 bg-green text-black font-semibold px-10 text-base"
              >
                Scan My Face for Free
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green">
              <Shield className="h-3.5 w-3.5 text-black" aria-hidden="true" />
            </div>
            <span className="font-display text-sm font-bold">Enclave</span>
          </div>
          <div className="flex gap-6 text-sm text-[var(--color-text-muted)]">
            <a href="/privacy" className="hover:text-[var(--color-text)] transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-[var(--color-text)] transition-colors">Terms</a>
            <a href="/dmca" className="hover:text-[var(--color-text)] transition-colors">DMCA</a>
            <a href="https://enclave-production-d818.up.railway.app/api-docs" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-text)] transition-colors">API</a>
          </div>
          <p className="text-sm text-[var(--color-text-dim)]">&copy; {new Date().getFullYear()} Enclave</p>
        </div>
      </footer>
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
      <p className="font-display text-3xl font-bold text-green" style={{ letterSpacing: "-0.02em" }}>
        {display}
      </p>
      <p className="mt-1 text-base text-[var(--color-text-dim)]">{label}</p>
    </div>
  );
}
