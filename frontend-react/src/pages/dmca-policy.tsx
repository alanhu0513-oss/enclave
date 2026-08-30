import { ArrowLeft, Shield, FileText, Mail, Clock, AlertTriangle } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";

export function DmcaPolicy() {
  return (
    <div className="min-h-screen bg-surface-0 text-ink">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <FadeIn>
          <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Enclave
          </a>

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="font-display text-3xl font-bold text-ink">DMCA & Takedown Policy</h1>
          </div>

          <p className="mb-6 text-sm text-ink-muted">Last updated: August 30, 2026</p>

          <div className="space-y-8 text-sm leading-relaxed text-ink-muted">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">1. Overview</h2>
              <p>Enclave provides tools to help you detect and remove unauthorized use of your identity online. This policy explains how our takedown services work and the legal framework behind them.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">2. What Enclave Does</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <FileText className="mb-2 h-5 w-5 text-cyan" />
                  <h3 className="font-medium text-ink">Generate Notices</h3>
                  <p className="mt-1 text-xs">We draft DMCA, Cease & Desist, and TAKE IT DOWN Act notices customized for each platform.</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <Mail className="mb-2 h-5 w-5 text-cyan" />
                  <h3 className="font-medium text-ink">Send to Platforms</h3>
                  <p className="mt-1 text-xs">We send notices to platform abuse teams via their published DMCA channels.</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <Clock className="mb-2 h-5 w-5 text-cyan" />
                  <h3 className="font-medium text-ink">Track & Escalate</h3>
                  <p className="mt-1 text-xs">We monitor responses and escalate after 48 hours if no action is taken.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">3. Legal Basis</h2>
              <div className="mt-2 space-y-3">
                <div>
                  <h3 className="font-medium text-ink">DMCA (Digital Millennium Copyright Act)</h3>
                  <p>If your original content (photos, videos) has been used without permission, we can send DMCA takedown notices to hosting providers and platforms.</p>
                </div>
                <div>
                  <h3 className="font-medium text-ink">TAKE IT DOWN Act (2025)</h3>
                  <p>Federal law requiring platforms to remove non-consensual intimate imagery (NCII) within 48 hours of receiving a valid request. We generate compliant notices for this.</p>
                </div>
                <div>
                  <h3 className="font-medium text-ink">State Laws</h3>
                  <p>Many states have specific laws against deepfakes, non-consensual pornography, and identity theft. We tailor notices to applicable state statutes.</p>
                </div>
                <div>
                  <h3 className="font-medium text-ink">Platform Terms of Service</h3>
                  <p>Most platforms prohibit impersonation and non-consensual content in their ToS. We cite relevant provisions in our notices.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">4. What You Need to Provide</h2>
              <p>To initiate a takedown, you must provide:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                <li>Identification of the copyrighted work or your identity being misused</li>
                <li>URLs or locations of the infringing content</li>
                <li>Your contact information (used in the notice)</li>
                <li>A statement of good faith belief that the use is unauthorized</li>
                <li>A statement of accuracy under penalty of perjury</li>
              </ul>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber/20 bg-amber/[0.05] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                <p className="text-xs"><strong>Important:</strong> Filing a false DMCA notice can result in legal liability. Only submit takedown requests for content that actually infringes on your rights.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">5. Evidence Preservation</h2>
              <p>When a takedown is initiated, Enclave automatically preserves evidence including:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                <li>HTML snapshots of the page containing the content</li>
                <li>Metadata (timestamps, URLs, server headers)</li>
                <li>Hash values of the original content</li>
                <li>Chain of custody records</li>
              </ul>
              <p className="mt-2">This evidence is stored encrypted and can be used for legal proceedings if needed.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">6. Platform Response Times</h2>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="text-ink">Major platforms (Meta, Google, TikTok)</span>
                  <span className="font-mono text-cyan">24-72 hours</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="text-ink">TAKE IT DOWN Act compliant platforms</span>
                  <span className="font-mono text-cyan">48 hours (required)</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="text-ink">Smaller platforms / forums</span>
                  <span className="font-mono text-amber">5-14 days</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="text-ink">Dark web / non-compliant</span>
                  <span className="font-mono text-red">May not respond</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">7. Escalation Process</h2>
              <p>If a platform does not respond within the expected timeframe:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                <li><strong>48 hours:</strong> Follow-up notice sent to the same abuse channel</li>
                <li><strong>7 days:</strong> Escalation to platform's legal/compliance team</li>
                <li><strong>14 days:</strong> Escalation to hosting provider</li>
                <li><strong>30 days:</strong> We provide documentation for legal action</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">8. Limitations</h2>
              <p>Enclave is not a law firm and does not provide legal advice. Our takedown services are administrative in nature. We cannot:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                <li>Guarantee removal of any content</li>
                <li>Represent you in legal proceedings</li>
                <li>Access private or authenticated content</li>
                <li>Remove content from archives or caches</li>
                <li>Enforce court orders (though we can help you obtain them)</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">9. Counter-Notifications</h2>
              <p>If you receive a counter-notification regarding content you had removed, Enclave will notify you immediately. You then have 10-14 business days to file a court action to maintain the removal.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">10. Contact</h2>
              <p>DMCA notices and takedown inquiries: <a href="mailto:dmca@enclave.ai" className="text-cyan hover:underline">dmca@enclave.ai</a></p>
              <p className="mt-1">Legal department: <a href="mailto:legal@enclave.ai" className="text-cyan hover:underline">legal@enclave.ai</a></p>
            </section>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
