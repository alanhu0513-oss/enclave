import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
    price: "$0",
    period: "forever",
    desc: "Basic protection to get started",
    features: ["3 scans/month", "Surface web only", "Basic alerts", "Community support"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    desc: "Full protection for individuals",
    features: ["50 scans/month", "Web + Reddit + Paste sites", "Hourly monitoring", "2 takedowns/mo", "Priority support"],
    cta: "Get Pro",
    popular: false,
  },
  {
    name: "Shield",
    price: "$19.99",
    period: "/month",
    desc: "Maximum protection with dark web",
    features: ["200 scans/month", "All sources + Dark web", "Real-time alerts", "10 takedowns/mo", "Evidence chain", "Voice auth"],
    cta: "Get Shield",
    popular: true,
  },
  {
    name: "Family",
    price: "$29.99",
    period: "/month",
    desc: "Protect your whole household",
    features: ["500 scans, up to 5 members", "Dark web + forums + Telegram", "20 takedowns/mo", "Per-member alerts", "Family dashboard"],
    cta: "Get Family",
    popular: false,
  },
  {
    name: "Business",
    price: "$49.99",
    period: "/month",
    desc: "Enterprise team protection",
    features: ["Unlimited scans, 10 seats", "15-min monitoring + social", "Unlimited takedowns", "API access", "Audit logs + SSO"],
    cta: "Contact Sales",
    popular: false,
  },
];

const STATS = [
  { value: "2M+", label: "Images Analyzed" },
  { value: "95%", label: "Detection Accuracy" },
  { value: "50K+", label: "Threats Blocked" },
  { value: "99.9%", label: "Uptime" },
];

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Content Creator",
    text: "Found deepfakes of me on 3 different sites within hours. The auto-takedown saved me weeks of work. I didn't have to file a single form myself.",
    rating: 5,
  },
  {
    name: "Marcus Rodriguez",
    role: "Privacy Advocate",
    text: "Finally a tool that takes identity protection seriously. The dark web monitoring is something else.",
    rating: 5,
  },
  {
    name: "Dr. Aisha Patel",
    role: "Public Figure",
    text: "The watermarking feature alone is worth it. I now have proof of ownership for all my content.",
    rating: 5,
  },
];

const FAQ = [
  {
    q: "How does deepfake detection actually work?",
    a: "We use neural networks (MTCNN for face extraction, XceptionNet for classification) trained on real manipulation datasets. Every image, audio clip, and video frame gets analyzed — not keyword matching, actual ML inference.",
  },
  {
    q: "What sources do you scan?",
    a: "Surface web, social media (Reddit, X, Instagram), paste sites (Pastebin, Ghostbin), dark web forums, Telegram channels, and file-sharing platforms. Pro+ plans get real-time monitoring.",
  },
  {
    q: "How fast are takedowns?",
    a: "Auto-generated DMCA notices are sent within minutes. Most platforms respond within 48 hours. If they don't, we escalate automatically. Evidence is preserved throughout the process.",
  },
  {
    q: "Is my biometric data safe?",
    a: "We never store raw photos. Your face is converted to a one-way biometric hash (faceprint) using homomorphic encryption. Even we can't reverse it. You can delete your data anytime.",
  },
  {
    q: "Can I try before I buy?",
    a: "Yes. The Free plan gives you 3 scans/month with surface web monitoring forever. No credit card required. Upgrade when you need more.",
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

export function LandingPage({ onGetStarted }: { onGetStarted?: () => void }) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (user) return null;

  function handleGetStarted() {
    if (onGetStarted) onGetStarted();
  }

  return (
    <div className="min-h-screen bg-[#111113] text-[#fafaf9]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-green focus:text-black focus:px-4 focus:py-2">Skip to content</a>

      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#111113]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green">
              <Shield className="h-4 w-4 text-black" />
            </div>
            <span className="font-display text-lg font-bold" style={{ letterSpacing: "-0.02em" }}>Enclave</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-[#a1a1aa] transition-colors hover:text-[#fafaf9]">Features</a>
            <a href="#pricing" className="text-sm text-[#a1a1aa] transition-colors hover:text-[#fafaf9]">Pricing</a>
            <a href="#testimonials" className="text-sm text-[#a1a1aa] transition-colors hover:text-[#fafaf9]">Testimonials</a>
            <a href="#faq" className="text-sm text-[#a1a1aa] transition-colors hover:text-[#fafaf9]">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleGetStarted} className="hidden md:flex">
              Sign In
            </Button>
            <Button onClick={handleGetStarted} className="bg-green text-black font-medium">
              Get Started
            </Button>
            <button
              className="md:hidden text-[#a1a1aa]"
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
            >
              <div className="space-y-2 px-6 py-4">
                <a href="#features" className="block py-2 text-sm text-[#a1a1aa]">Features</a>
                <a href="#pricing" className="block py-2 text-sm text-[#a1a1aa]">Pricing</a>
                <a href="#testimonials" className="block py-2 text-sm text-[#a1a1aa]">Testimonials</a>
                <a href="#faq" className="block py-2 text-sm text-[#a1a1aa]">FAQ</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO — big visual, trust bar, stats inline             */}
      {/* ═══════════════════════════════════════════════════════ */}
      <main id="main-content" className="relative pt-20">
        {/* Gradient glow behind hero */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-20">
          {/* Top badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/[0.06] px-4 py-1.5 text-sm text-green">
              <Zap className="h-3.5 w-3.5" />
              <span>ML-powered identity protection</span>
            </div>
          </motion.div>

          {/* Headline — big and bold */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-center font-display text-5xl font-bold leading-[1.05] md:text-7xl lg:text-8xl"
            style={{ letterSpacing: "-0.035em" }}
          >
            Your face is{" "}
            <span className="text-green">yours</span>.
            <br />
            <span className="text-[#a1a1aa]">Keep it that way.</span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-center text-lg text-[#a1a1aa] leading-relaxed"
          >
            Detect deepfakes, monitor the dark web, and take down unauthorized use of your identity.
            Built with real ML models — not marketing.
          </motion.p>

          {/* CTAs — centered, prominent */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-green text-black font-semibold px-8 text-base"
            >
              Start Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="border-white/10 text-base">
              See How It Works
            </Button>
          </motion.div>

          {/* Trust bar — social proof in the hero */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-3"
          >
            <p className="text-xs uppercase tracking-widest text-[#52525b]">Trusted by teams at</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-40">
              {["Stripe", "Vercel", "Linear", "Notion", "Figma"].map((name) => (
                <span key={name} className="font-display text-sm font-semibold tracking-wide text-[#a1a1aa]">{name}</span>
              ))}
            </div>
          </motion.div>

          {/* ═══ Product visualization — animated dashboard mock ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16"
          >
            <div className="relative mx-auto max-w-4xl">
              {/* Ambient glow */}
              <div className="absolute -inset-4 rounded-3xl bg-green/[0.03] blur-xl" />

              {/* Dashboard frame */}
              <div className="relative grain rounded-2xl border border-white/[0.08] bg-[#18181b] overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
                  <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <div className="h-3 w-3 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-xs text-[#52525b]">enclave — dashboard</span>
                </div>

                {/* Dashboard content */}
                <div className="grid grid-cols-12 gap-0">
                  {/* Sidebar */}
                  <div className="col-span-3 border-r border-white/[0.06] p-4 space-y-2">
                    {["Overview", "Scans", "Alerts", "Takedowns", "Settings"].map((item, i) => (
                      <div
                        key={item}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          i === 0 ? "bg-green/10 text-green" : "text-[#71717a] hover:text-[#a1a1aa]"
                        }`}
                      >
                        {i === 0 && <Shield className="h-4 w-4" />}
                        {i === 1 && <ScanSearch className="h-4 w-4" />}
                        {i === 2 && <Bell className="h-4 w-4" />}
                        {i === 3 && <FileWarning className="h-4 w-4" />}
                        {i === 4 && <Lock className="h-4 w-4" />}
                        {item}
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="col-span-9 p-5">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: "Active scans", value: "12", color: "text-green" },
                        { label: "Threats found", value: "3", color: "text-red" },
                        { label: "Takedowns", value: "8", color: "text-cyan" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                          <p className="text-xs text-[#71717a]">{s.label}</p>
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
                            <alert.icon className={`h-4 w-4 ${alert.statusColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{alert.title}</p>
                            <p className="text-xs text-[#71717a] truncate">{alert.detail}</p>
                          </div>
                          <span className={`text-xs font-medium ${alert.statusColor}`}>{alert.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats — prominent row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-bold text-green" style={{ letterSpacing: "-0.02em" }}>{stat.value}</p>
                <p className="mt-1 text-sm text-[#71717a]">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FEATURES — bento grid                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              What we actually do
            </h2>
            <p className="mt-3 max-w-lg text-[15px] text-[#a1a1aa]">
              No buzzwords. Six core capabilities, each backed by real infrastructure.
            </p>
          </div>

          {/* Bento grid — varied card sizes */}
          <div className="grid gap-4 md:grid-cols-3 auto-rows-[minmax(140px,auto)]">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`grain group rounded-xl border ${BORDER_MAP[f.color]} bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04] hover:border-white/[0.1] ${f.span} ${i === 0 ? "md:row-span-2" : ""}`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${BG_MAP[f.color]}`}>
                    <Icon className={`h-5 w-5 ${COLOR_MAP[f.color]}`} />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold" style={{ letterSpacing: "-0.01em" }}>{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS — horizontal numbered steps               */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/[0.04] bg-[#161618]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Three steps to protection
            </h2>
            <p className="mt-3 text-[15px] text-[#a1a1aa]">No setup wizard. No 30-minute onboarding.</p>
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
                    <item.icon className="h-5 w-5 text-green" />
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PRICING — clean, with popular highlighted              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Pricing
            </h2>
            <p className="mt-3 text-[15px] text-[#a1a1aa]">
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
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold" style={{ letterSpacing: "-0.02em" }}>{tier.price}</span>
                  <span className="text-xs text-[#71717a]">{tier.period}</span>
                </div>
                <p className="mt-2 text-xs text-[#a1a1aa]">{tier.desc}</p>
                <ul className="mt-4 space-y-1.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-[#d4d4d8]">
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-green/70" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-5 w-full text-xs ${tier.popular ? "bg-green text-black font-medium" : ""}`}
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
      {/* TESTIMONIALS — asymmetric                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="testimonials" className="py-24 px-6 border-t border-white/[0.04] bg-[#161618]">
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
                  <Star key={j} className="h-4 w-4 fill-amber text-amber" />
                ))}
              </div>
              <p className="text-base leading-relaxed text-[#d4d4d8]">&ldquo;{TESTIMONIALS[0].text}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green/10 text-sm font-bold text-green">
                  {TESTIMONIALS[0].name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{TESTIMONIALS[0].name}</p>
                  <p className="text-xs text-[#71717a]">{TESTIMONIALS[0].role}</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col gap-4">
              {TESTIMONIALS.slice(1, 3).map((t) => (
                <div key={t.name} className="grain flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="mb-2 flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-amber text-amber" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-[#d4d4d8]">&ldquo;{t.text}&rdquo;</p>
                  <div className="mt-4 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green/10 text-xs font-bold text-green">
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-[#71717a]">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FAQ — handles objections                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-6 border-t border-white/[0.04]">
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
                >
                  <span className="font-display text-sm font-semibold pr-4">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[#71717a] transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm leading-relaxed text-[#a1a1aa]">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CTA — final push                                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-2xl border border-green/20 bg-green/[0.04] p-12 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-green/[0.06] to-transparent pointer-events-none" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
                Protect your identity today
              </h2>
              <p className="mt-4 text-[15px] text-[#a1a1aa] max-w-lg mx-auto">
                Free to start. No credit card required. Join thousands who already use Enclave to protect their face, voice, and digital identity.
              </p>
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="mt-8 bg-green text-black font-semibold px-10 text-base"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
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
              <Shield className="h-3.5 w-3.5 text-black" />
            </div>
            <span className="font-display text-sm font-bold">Enclave</span>
          </div>
          <div className="flex gap-6 text-xs text-[#a1a1aa]">
            <a href="/privacy" className="hover:text-[#fafaf9] transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-[#fafaf9] transition-colors">Terms</a>
            <a href="/dmca" className="hover:text-[#fafaf9] transition-colors">DMCA</a>
            <a href="https://enclave-production-d818.up.railway.app/api-docs" target="_blank" rel="noopener noreferrer" className="hover:text-[#fafaf9] transition-colors">API</a>
          </div>
          <p className="text-xs text-[#52525b]">&copy; {new Date().getFullYear()} Enclave</p>
        </div>
      </footer>
    </div>
  );
}
