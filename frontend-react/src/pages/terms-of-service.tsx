import { ArrowLeft, Shield } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";

export function TermsOfService() {
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
            <h1 className="font-display text-3xl font-bold text-ink">Terms of Service</h1>
          </div>

          <p className="mb-6 text-sm text-ink-muted">Last updated: August 30, 2026</p>

          <div className="space-y-8 text-sm leading-relaxed text-ink-muted">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">1. Acceptance of Terms</h2>
              <p>By accessing or using Enclave ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. Enclave is operated by Enclave Technologies, Inc. ("Company", "we", "us", or "our").</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">2. Description of Service</h2>
              <p>Enclave provides AI-powered identity protection services including deepfake detection, dark web monitoring, content takedown assistance, and identity verification. The Service scans public and dark web sources to detect unauthorized use of your identity.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">3. Account Registration</h2>
              <p>You must provide accurate, complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. You must be at least 16 years old to use the Service.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">4. Subscription Plans</h2>
              <p>The Service offers free and paid subscription tiers. Paid plans are billed monthly through Stripe. You may cancel at any time from your account settings. Cancellation takes effect at the end of the current billing period. No partial refunds are issued.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                <li>Use the Service for any unlawful purpose</li>
                <li>Attempt to circumvent rate limits or access controls</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                <li>Use automated tools to access the Service except as permitted by API</li>
                <li>Resell or redistribute the Service without written permission</li>
                <li>Submit false or misleading information</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">6. Intellectual Property</h2>
              <p>The Service, including its design, code, and content, is owned by Enclave Technologies, Inc. and protected by copyright, trademark, and other intellectual property laws. You retain ownership of any data you submit to the Service.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">7. User Content</h2>
              <p>You grant us a limited license to process, analyze, and store content you submit solely for the purpose of providing the Service. We do not use your content for training machine learning models or for any purpose other than delivering the Service to you.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">8. Takedown Services</h2>
              <p>Enclave facilitates takedown requests by generating documentation and providing guidance. We do not guarantee that any platform will remove content upon request. You are responsible for the accuracy of information provided for takedown requests.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">9. Disclaimer of Warranties</h2>
              <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE. WE DO NOT GUARANTEE THE DETECTION OF ALL DEEPFAKES OR IDENTITY MISUSE.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">10. Limitation of Liability</h2>
              <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, ENCLADE TECHNOLOGIES, INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, REVENUE, OR PROFITS, ARISING FROM YOUR USE OF THE SERVICE.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">11. Indemnification</h2>
              <p>You agree to indemnify and hold harmless Enclave Technologies, Inc. and its officers, directors, employees, and agents from any claims, losses, or damages arising from your use of the Service or violation of these Terms.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">12. Termination</h2>
              <p>We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service ceases immediately. We may retain data as required by law or for legitimate business purposes.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">13. Governing Law</h2>
              <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Delaware.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">14. Changes to Terms</h2>
              <p>We reserve the right to modify these Terms at any time. Material changes will be notified via email or in-app notification. Continued use after changes constitutes acceptance of the modified Terms.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">15. Contact</h2>
              <p>Questions about these Terms? Contact us at <a href="mailto:legal@enclave.ai" className="text-cyan hover:underline">legal@enclave.ai</a>.</p>
            </section>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
