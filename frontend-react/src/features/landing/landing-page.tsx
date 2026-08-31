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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Deepfake Detection",
    desc: "ML models analyze images, audio, and video to catch manipulation before it spreads. Not keyword matching — actual neural network inference on every frame.",
    color: "cyan",
  },
  {
    icon: Radar,
    title: "Dark Web Monitoring",
    desc: "Continuous scanning across surface web, Reddit, paste sites, and hidden forums.",
    color: "purple",
  },
  {
    icon: Bell,
    title: "Threat Alerts",
    desc: "Real-time push notifications and email the moment something is found.",
    color: "green",
  },
  {
    icon: Shield,
    title: "Auto Takedown",
    desc: "Automatic DMCA notices with 48-hour escalation and evidence preservation.",
    color: "amber",
  },
  {
    icon: Lock,
    title: "Content Watermarking",
    desc: "Invisible watermarks and C2PA credentials prove ownership and deter theft.",
    color: "cyan",
  },
  {
    icon: Eye,
    title: "Face Analysis",
    desc: "Detect and compare multiple faces against your enrolled biometric profile.",
    color: "purple",
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

export function LandingPage({ onGetStarted }: { onGetStarted?: () => void }) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        {/* Mobile menu */}
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero — asymmetric, grounded */}
      <main id="main-content" className="relative min-h-screen flex items-center px-6 pt-20">
        <div className="mx-auto max-w-6xl w-full">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left: copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <p className="mb-4 text-sm font-medium tracking-wide uppercase text-[#71717a]">
                  Identity Protection
                </p>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="font-display text-4xl font-bold leading-[1.1] md:text-6xl"
                style={{ letterSpacing: "-0.03em" }}
              >
                Your face is{" "}
                <span className="text-green">yours</span>.
                <br />
                Keep it that way.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-6 max-w-lg text-[15px] leading-relaxed text-[#a1a1aa]"
              >
                Detect deepfakes, monitor the dark web, and take down
                unauthorized use of your identity. Built with real ML models, not marketing.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <Button
                  size="lg"
                  onClick={handleGetStarted}
                  className="bg-green text-black font-medium px-6"
                >
                  Start Free
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" className="border-white/10">
                  See How It Works
                </Button>
              </motion.div>

              {/* Stats — inline with left border accent */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-12 flex gap-8 border-t border-white/[0.06] pt-8"
              >
                {STATS.map((stat) => (
                  <div key={stat.label} className="pl-3 border-l-2 border-green/20">
                    <p className="font-display text-2xl font-bold" style={{ letterSpacing: "-0.02em" }}>{stat.value}</p>
                    <p className="mt-0.5 text-xs text-[#71717a]">{stat.label}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: visual element */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute -inset-8 rounded-3xl bg-white/[0.02] blur-sm" />
                <div className="relative grain rounded-2xl border border-white/[0.06] bg-[#18181b] p-8">
                  {/* Mock UI card */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-3 w-3 rounded-full bg-green" />
                    <div className="h-3 w-3 rounded-full bg-amber" />
                    <div className="h-3 w-3 rounded-full bg-red" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan/10">
                        <ScanSearch className="h-5 w-5 text-cyan" />
                      </div>
                      <div className="flex-1">
                        <div className="h-3 w-24 rounded bg-white/10" />
                        <div className="mt-1.5 h-2 w-36 rounded bg-white/5" />
                      </div>
                      <div className="text-xs font-medium text-green">Safe</div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red/10">
                        <Radar className="h-5 w-5 text-red" />
                      </div>
                      <div className="flex-1">
                        <div className="h-3 w-20 rounded bg-white/10" />
                        <div className="mt-1.5 h-2 w-28 rounded bg-white/5" />
                      </div>
                      <div className="text-xs font-medium text-red">Threat</div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green/10">
                        <Shield className="h-5 w-5 text-green" />
                      </div>
                      <div className="flex-1">
                        <div className="h-3 w-28 rounded bg-white/10" />
                        <div className="mt-1.5 h-2 w-32 rounded bg-white/5" />
                      </div>
                      <div className="text-xs font-medium text-green">Protected</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Features — broken grid, no scroll animation */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              What we actually do
            </h2>
            <p className="mt-3 max-w-lg text-[15px] text-[#a1a1aa]">
              No buzzwords. Six core capabilities, each backed by real infrastructure.
            </p>
          </div>

          {/* Feature 1: full-width horizontal */}
          <div className="mb-4">
            {(() => {
              const Icon = FEATURES[0].icon;
              return (
                <div className="group flex items-start gap-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04] hover:border-white/[0.1]">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${BG_MAP[FEATURES[0].color]}`}>
                    <Icon className={`h-6 w-6 ${COLOR_MAP[FEATURES[0].color]}`} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold" style={{ letterSpacing: "-0.02em" }}>{FEATURES[0].title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-[#a1a1aa] max-w-2xl">{FEATURES[0].desc}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Features 2-3: 2-column */}
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            {FEATURES.slice(1, 3).map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04] hover:border-white/[0.1]"
                >
                  <Icon className={`mb-3 h-5 w-5 ${COLOR_MAP[f.color]}`} />
                  <h3 className="font-display text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#a1a1aa]">{f.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Features 4-6: 3-column */}
          <div className="grid gap-4 md:grid-cols-3">
            {FEATURES.slice(3, 6).map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04] hover:border-white/[0.1]"
                >
                  <Icon className={`mb-3 h-5 w-5 ${COLOR_MAP[f.color]}`} />
                  <h3 className="font-display text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#a1a1aa]">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works — vertical timeline */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Three steps
            </h2>
          </div>

          <div className="relative max-w-xl">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/[0.08]" />

            {[
              { step: "1", title: "Enroll your face", desc: "Upload a photo. We create a biometric hash in seconds." },
              { step: "2", title: "We scan everywhere", desc: "Surface web, social media, paste sites, dark web. Continuously." },
              { step: "3", title: "We act", desc: "Instant alerts. Automatic takedowns. Evidence preserved." },
            ].map((item) => (
              <div key={item.step} className="relative flex gap-5 pb-10 last:pb-0">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#111113] bg-white/[0.06] text-sm font-bold text-[#71717a]">
                  {item.step}
                </div>
                <div className="pt-1">
                  <h3 className="font-display text-base font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#a1a1aa]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — static, no animation */}
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

      {/* Testimonials — asymmetric: first card larger */}
      <section id="testimonials" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              What people say
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {/* First testimonial: larger, spans 3 cols */}
            <div className="md:col-span-3 grain rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: TESTIMONIALS[0].rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber text-amber" />
                ))}
              </div>
              <p className="text-base leading-relaxed text-[#d4d4d8]">&ldquo;{TESTIMONIALS[0].text}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold">
                  {TESTIMONIALS[0].name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{TESTIMONIALS[0].name}</p>
                  <p className="text-xs text-[#71717a]">{TESTIMONIALS[0].role}</p>
                </div>
              </div>
            </div>

            {/* Testimonials 2-3: stacked in 2 cols */}
            <div className="md:col-span-2 flex flex-col gap-4">
              {TESTIMONIALS.slice(1, 3).map((t) => (
                <div
                  key={t.name}
                  className="grain flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
                >
                  <div className="mb-2 flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-amber text-amber" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-[#d4d4d8]">&ldquo;{t.text}&rdquo;</p>
                  <div className="mt-4 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold">
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

      {/* CTA — asymmetric, not centered */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.025em" }}>
                Protect your identity
              </h2>
              <p className="mt-3 text-[15px] text-[#a1a1aa]">
                Free to start. No credit card required.
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-green text-black font-medium px-8 shrink-0"
            >
              Get Started
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer — minimal */}
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
