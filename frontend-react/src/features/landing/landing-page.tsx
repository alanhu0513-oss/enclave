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
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "AI Deepfake Detection",
    desc: "Advanced ML models analyze images, audio, and video to detect manipulation with 95%+ accuracy.",
    color: "cyan",
  },
  {
    icon: Radar,
    title: "24/7 Dark Web Monitoring",
    desc: "Continuous scanning across surface web, Reddit, paste sites, dark web, and social media.",
    color: "purple",
  },
  {
    icon: Bell,
    title: "Instant Threat Alerts",
    desc: "Real-time push notifications, email alerts, and in-app warnings the moment a threat is detected.",
    color: "green",
  },
  {
    icon: Shield,
    title: "Auto Takedown & DMCA",
    desc: "Automatic takedown notices with 48-hour escalation, evidence preservation, and lifecycle tracking.",
    color: "amber",
  },
  {
    icon: Lock,
    title: "Watermark & Rights Shield",
    desc: "Invisible watermarks and C2PA content credentials prove ownership and deter theft.",
    color: "cyan",
  },
  {
    icon: Eye,
    title: "Multi-Face Analysis",
    desc: "Detect and compare multiple faces in images against your enrolled biometric profile.",
    color: "purple",
  },
];

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Get started with basic protection",
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
    text: "Enclave found deepfakes of me on 3 different sites within hours of scanning. The auto-takedown saved me weeks of work.",
    rating: 5,
  },
  {
    name: "Marcus Rodriguez",
    role: "Privacy Advocate",
    text: "Finally a tool that takes identity protection seriously. The dark web monitoring is incredible.",
    rating: 5,
  },
  {
    name: "Dr. Aisha Patel",
    role: "Public Figure",
    text: "The watermarking feature alone is worth it. I now have proof of ownership for all my content.",
    rating: 5,
  },
];

export function LandingPage({ onGetStarted }: { onGetStarted?: () => void }) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (user) return null;

  function handleGetStarted() {
    if (onGetStarted) onGetStarted();
  }

  return (
    <div className="min-h-screen bg-[#04060a] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#04060a]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green to-cyan">
              <Shield className="h-5 w-5 text-black" />
            </div>
            <span className="font-display text-xl font-bold">Enclave</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-gray-300 transition-colors hover:text-white">Features</a>
            <a href="#pricing" className="text-sm text-gray-300 transition-colors hover:text-white">Pricing</a>
            <a href="#testimonials" className="text-sm text-gray-300 transition-colors hover:text-white">Testimonials</a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleGetStarted} className="hidden md:flex">
              Sign In
            </Button>
            <Button onClick={handleGetStarted} className="bg-gradient-to-r from-green to-cyan text-black font-semibold">
              Get Started Free
            </Button>
            <button
              className="md:hidden text-gray-400"
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
              className="overflow-hidden border-t border-white/5 md:hidden"
            >
              <div className="space-y-2 px-6 py-4">
                <a href="#features" className="block py-2 text-sm text-gray-400">Features</a>
                <a href="#pricing" className="block py-2 text-sm text-gray-400">Pricing</a>
                <a href="#testimonials" className="block py-2 text-sm text-gray-400">Testimonials</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green/5 blur-[120px]" />
          <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-cyan/5 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-purple/5 blur-[100px]" />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-400">
              <Sparkles className="h-4 w-4 text-cyan" />
              AI-Powered Identity Protection
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl"
          >
            Your Identity.{" "}
            <span className="bg-gradient-to-r from-green via-cyan to-purple bg-clip-text text-transparent">
              Protected.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-gray-400"
          >
            Detect deepfakes, monitor the dark web, and automatically take down
            unauthorized use of your identity — all powered by advanced AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-green to-cyan px-8 text-black font-semibold shadow-lg shadow-green/20 transition-all hover:shadow-green/40"
            >
              Start Protecting Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="border-white/10">
              Watch Demo
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-4"
          >
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-32 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              Everything you need to{" "}
              <span className="text-cyan">stay safe</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              From AI detection to automatic takedowns, Enclave provides comprehensive identity protection.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const colorMap: Record<string, string> = {
                cyan: "from-cyan/20 to-cyan/5 text-cyan",
                purple: "from-purple/20 to-purple/5 text-purple",
                green: "from-green/20 to-green/5 text-green",
                amber: "from-amber/20 to-amber/5 text-amber",
              };
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${colorMap[f.color]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-400">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative py-32 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              How it <span className="text-green">works</span>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "Enroll your face", desc: "Upload a photo to create your biometric profile in seconds." },
              { step: "02", title: "We scan the web", desc: "Our AI crawls surface web, social media, paste sites, and the dark web." },
              { step: "03", title: "We protect you", desc: "Get instant alerts and automatic takedowns for any threats found." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                viewport={{ once: true }}
                className="relative text-center"
              >
                <div className="mb-4 font-display text-6xl font-bold text-gray-600" aria-hidden="true">{item.step}</div>
                <h3 className="font-display text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-32 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              Simple, <span className="text-amber">transparent</span> pricing
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Start free. Upgrade when you need more protection.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`relative rounded-2xl border p-6 transition-all ${
                  tier.popular
                    ? "border-cyan/40 bg-cyan/[0.03] shadow-lg shadow-cyan/10"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan px-3 py-1 text-xs font-bold text-black">
                    Most Popular
                  </div>
                )}
                <h3 className="font-display text-lg font-bold">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{tier.price}</span>
                  <span className="text-sm text-gray-400">{tier.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-400">{tier.desc}</p>
                <ul className="mt-6 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-6 w-full ${tier.popular ? "bg-gradient-to-r from-green to-cyan text-black font-semibold" : ""}`}
                  variant={tier.popular ? "default" : "outline"}
                  onClick={handleGetStarted}
                >
                  {tier.cta}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative py-32 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              Trusted by <span className="text-purple">thousands</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-6"
              >
                <div className="mb-3 flex gap-1">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber text-amber" />
                  ))}
                </div>
                <p className="text-sm text-gray-300">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-[400px] w-[400px] rounded-full bg-green/10 blur-[100px]" />
          </div>
          <div className="relative z-10">
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              Ready to protect your identity?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Join thousands of people who trust Enclave to keep their identity safe.
              Start free — no credit card required.
            </p>
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="mt-8 bg-gradient-to-r from-green to-cyan px-10 text-black font-semibold shadow-lg shadow-green/20"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-16 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green to-cyan">
                  <Shield className="h-4 w-4 text-black" />
                </div>
                <span className="font-display text-lg font-bold">Enclave</span>
              </div>
              <p className="mt-3 text-sm text-gray-400">AI-powered identity protection for everyone.</p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Product</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="https://enclave-production-d818.up.railway.app/api-docs" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">API Docs</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Company</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/dmca" className="hover:text-white transition-colors">DMCA Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-white/5 pt-8 text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Enclave. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
