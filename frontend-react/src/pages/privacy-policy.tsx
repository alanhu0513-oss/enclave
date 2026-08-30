import { ArrowLeft, Shield } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";

export function PrivacyPolicy() {
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
            <h1 className="font-display text-3xl font-bold text-ink">Privacy Policy</h1>
          </div>

          <p className="mb-6 text-sm text-ink-muted">Last updated: August 30, 2026</p>

          <div className="space-y-8 text-sm leading-relaxed text-ink-muted">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">1. Introduction</h2>
              <p>Enclave Technologies, Inc. ("Enclave", "we", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our identity protection service.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">2. Information We Collect</h2>
              <div className="mt-2 space-y-3">
                <div>
                  <h3 className="font-medium text-ink">Account Information</h3>
                  <p>Email address, full name, and encrypted password. Optional: profile photo, phone number for push notifications.</p>
                </div>
                <div>
                  <h3 className="font-medium text-ink">Identity Data</h3>
                  <p>Face scans and biometric embeddings (stored encrypted, used for matching). You may delete these at any time from Settings.</p>
                </div>
                <div>
                  <h3 className="font-medium text-ink">Scan Data</h3>
                  <p>Images, URLs, and text you submit for analysis. Processing results and confidence scores. This data is processed in real-time and stored only on your account.</p>
                </div>
                <div>
                  <h3 className="font-medium text-ink">Monitoring Data</h3>
                  <p>Alerts generated from monitoring public and dark web sources. Takedown requests and their status. Evidence preservation snapshots.</p>
                </div>
                <div>
                  <h3 className="font-medium text-ink">Usage Data</h3>
                  <p>Pages visited, features used, scan counts, timestamps. Device type, browser, IP address (for rate limiting and security). Umami analytics (anonymous, no cookies).</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">3. How We Use Your Information</h2>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                <li>Provide and maintain the identity protection service</li>
                <li>Process scans and detect deepfakes / identity misuse</li>
                <li>Monitor dark web sources for your identity</li>
                <li>Generate and send takedown requests on your behalf</li>
                <li>Send alerts about detected threats</li>
                <li>Process payments through Stripe (we do not store card numbers)</li>
                <li>Improve the Service through aggregated, anonymized usage data</li>
                <li>Enforce rate limits and prevent abuse</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">4. Data Storage & Security</h2>
              <p>Your data is stored in encrypted databases (AES-256). Passwords are hashed with bcrypt. Biometric data is encrypted at rest and in transit. We use TLS 1.3 for all connections. Our infrastructure is hosted on Railway (AWS us-east-1) and Vercel (global edge network).</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">5. Data Sharing</h2>
              <p>We do not sell your personal data. We share data only with:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                <li><strong>Stripe:</strong> Payment processing (PCI-DSS compliant)</li>
                <li><strong>Firebase:</strong> Push notifications (FCM)</li>
                <li><strong>Email providers:</strong> Transactional and alert emails</li>
                <li><strong>Law enforcement:</strong> Only when legally required</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">6. Dark Web Monitoring</h2>
              <p>Our dark web monitoring service searches public dark web indexes and forums. We do not access private systems or conduct unauthorized access. Monitoring is limited to publicly available information that may indicate identity misuse.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                <li>Access all data we hold about you</li>
                <li>Export your data in machine-readable format</li>
                <li>Delete your account and all associated data</li>
                <li>Opt out of non-essential data collection</li>
                <li>Withdraw consent for biometric processing</li>
                <li>Correct inaccurate information</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">8. Data Retention</h2>
              <p>Account data is retained while your account is active. Upon deletion, all personal data is removed within 30 days. Anonymized, aggregated data may be retained indefinitely. Takedown records may be retained longer for legal compliance.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">9. Children's Privacy</h2>
              <p>The Service is not directed to children under 16. We do not knowingly collect data from children. If we learn that a child under 16 has provided personal information, we will delete it promptly.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">10. International Users</h2>
              <p>The Service is operated from the United States. If you access from outside the US, you consent to data transfer to the US. We comply with GDPR for EU users and CCPA for California residents.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">11. Cookies</h2>
              <p>We use only essential cookies for authentication. Analytics is handled by Umami (cookieless). No third-party tracking cookies are used.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">12. Changes to This Policy</h2>
              <p>We may update this Privacy Policy periodically. Material changes will be notified via email. The "Last updated" date at the top indicates the latest revision.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">13. Contact</h2>
              <p>Privacy questions? Contact our Data Protection Officer at <a href="mailto:privacy@enclave.ai" className="text-cyan hover:underline">privacy@enclave.ai</a>.</p>
            </section>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
