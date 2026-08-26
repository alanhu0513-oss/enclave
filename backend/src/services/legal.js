/* ─── Enclave Legal Documents ───
 * Structured ToS / Privacy Policy / DMCA Policy served via public API.
 * Versioned so the UI can display effective dates.
 */

const DOCUMENTS = {
  tos: {
    id: 'tos',
    title: 'Terms of Service',
    version: '1.0',
    updatedAt: '2026-08-26',
    intro: 'These Terms of Service ("Terms") govern your use of Enclave, a digital identity protection service ("Service"). By creating an account or using the Service, you agree to these Terms.',
    sections: [
      { heading: '1. The Service', body: 'Enclave provides: (a) AI-based detection of synthetic media (deepfakes) in images, audio, and text; (b) monitoring of publicly accessible sources for unauthorized uses of your registered identity; and (c) takedown assistance including document generation, delivery to platform abuse contacts, evidence preservation, and removal verification.' },
      { heading: '2. Eligibility & Accounts', body: 'You must be at least 16 years old and able to form a binding contract. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. You must provide accurate registration information, including your legal name, which is used for monitoring and legal document generation.' },
      { heading: '3. Acceptable Use', body: 'You may only submit content you have the right to analyze, and may only request takedowns for material that depicts you or that you are authorized to act for. You may not use the Service to harass, defraud, misattribute identity, or knowingly file false infringement claims. False DMCA claims carry liability under 17 U.S.C. § 512(f).' },
      { heading: '4. Detection Accuracy Disclaimer', body: 'AI-based deepfake detection is probabilistic. Results include confidence scores and are provided for decision support, not as a guarantee of accuracy. The Service may produce false positives and false negatives. Published benchmark results describe aggregate performance on test datasets and do not promise any specific outcome for your content.' },
      { heading: '5. Takedown Assistance — Not Legal Advice', body: 'Takedown notices are template-based documents generated from information you provide. Nothing in the Service constitutes legal advice, and no attorney-client relationship is created. For complex matters, counter-notifications, or litigation, consult a qualified attorney.' },
      { heading: '6. Third-Party Platforms', body: 'Removal of content depends entirely on the hosting platform. We cannot guarantee any platform will remove content, respond within any period, or comply with legal demands. Verification re-crawls check URL liveness but cannot detect copies on pages that block automated access.' },
      { heading: '7. Subscriptions & Billing', body: 'Paid tiers renew monthly until cancelled. Prices are shown before applicable taxes. You may cancel anytime; cancellation takes effect at the end of the current billing period. Refunds are handled per our money-back guarantee terms stated at purchase.' },
      { heading: '8. Service Availability', body: 'The Service relies on third-party AI inference providers, search engines, and free-tier cloud infrastructure. Sources may be temporarily unavailable, rate-limited, or degraded. We aim for high availability but do not guarantee uninterrupted operation on any specific tier except where an SLA is separately contracted.' },
      { heading: '9. Limitation of Liability', body: 'To the maximum extent permitted by law, the Service is provided "as is" without warranties of any kind. Our aggregate liability for any claim is limited to the amount you paid us in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages, including reputational harm from content we fail to detect or remove.' },
      { heading: '10. Termination', body: 'You may delete your account and data at any time from Settings → Data. We may suspend or terminate accounts that violate these Terms, abuse rate limits, or create legal risk for the Service or its users.' },
      { heading: '11. Changes', body: 'We may modify these Terms with notice through the Service. Continued use after changes take effect constitutes acceptance.' },
      { heading: '12. Contact', body: 'Questions about these Terms: legal@enclave.app (or the contact address published in the Service footer).' },
    ],
  },

  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    version: '1.0',
    updatedAt: '2026-08-26',
    intro: 'This policy explains what Enclave collects, why, how long it is kept, and the controls you have. Summary principle: we collect the minimum needed to protect your identity, and you can export or erase everything at any time.',
    sections: [
      { heading: '1. Data We Collect', body: 'Account data (email, name, auth provider ID). Biometric baselines you enroll (faceprint embedding, voiceprint, signature image) — stored to enable identity verification. Content you submit for analysis (images/audio/text). Monitoring findings (URLs, snippets, confidence scores). Takedown records and preserved evidence (page snapshots, metadata, perceptual hashes). Usage counters (scans, takedowns, API calls per month).' },
      { heading: '2. What We Do NOT Sell or Share', body: 'We never sell your personal data. Submitted media is sent to AI inference providers (e.g., Google Gemini, Mistral) solely for analysis under their no-training API terms where available, and is retained by them per their retention windows. We do not share your data with advertisers or data brokers.' },
      { heading: '3. Legal Bases (GDPR)', body: 'Contract performance (Art. 6(1)(b)) — providing detection, monitoring, and takedown services you request. Legitimate interests (Art. 6(1)(f)) — securing the Service, preventing abuse. Consent (Art. 6(1)(a)) — optional notifications; withdrawable anytime in Settings.' },
      { heading: '4. Retention', body: 'Detection results (non-alert scans): 90 days. Alerts and takedown evidence: 2 years (evidence hash chains support potential legal proceedings), then deleted. Account data: until deletion. Usage aggregates: 24 months. Backups roll off within 30 days. You can trigger earlier deletion yourself (see §6).' },
      { heading: '5. Security', body: 'Passwords are hashed (bcrypt). Sessions use signed JWTs. Biometric templates are stored as irreversible embeddings rather than raw captures where feasible. Evidence integrity is protected by SHA-256 hash chains so tampering is detectable.' },
      { heading: '6. Your Rights (GDPR/CCPA)', body: 'Access & portability: Settings → Data → Export All My Data produces a machine-readable JSON of everything we hold about you. Erasure: Settings → Data → Clear All Vault Data deletes your account and all associated records immediately. Objection/restriction: disable email alerts or monitoring anytime. Non-discrimination: exercising these rights never degrades your service. Complaints: you may contact your local supervisory authority.' },
      { heading: '7. International Transfers', body: 'Your data may be processed in the United States and other countries where our infrastructure providers operate. Transfers rely on provider standard contractual clauses or equivalent safeguards.' },
      { heading: '8. Children', body: 'The Service is not directed at children under 16, and we do not knowingly collect their data. Family plan administrators are responsible for minors\' accounts and consents.' },
      { heading: '9. Changes', body: 'Material changes to this policy will be announced in-app with advance notice of the effective date.' },
    ],
  },

  dmca: {
    id: 'dmca',
    title: 'DMCA Policy & Counter-Notification Procedure',
    version: '1.0',
    updatedAt: '2026-08-26',
    intro: 'This policy covers how Enclave handles copyright claims related to content it hosts or processes, and how counter-notifications work when a takedown is disputed.',
    sections: [
      { heading: '1. Scope', body: 'Enclave generates and delivers DMCA notices on behalf of users to third-party platforms. Enclave itself does not host user-uploaded infringing content publicly; submitted media exists solely for private analysis and evidence preservation tied to a specific case.' },
      { heading: '2. Notice Requirements (17 U.S.C. § 512(c)(3))', body: 'Notices generated by the Service include: identification of the copyrighted work; the allegedly infringing URL; complainant contact information; good-faith statement; accuracy statement under penalty of perjury; and physical/electronic signature of the rights holder or authorized agent.' },
      { heading: '3. Counter-Notification', body: 'If you receive a takedown generated through Enclave and believe your content was misidentified or you have authorization, you may file a DMCA counter-notification with the relevant platform. That platform — not Enclave — decides whether to restore content. If a counter-notification is recorded against one of our cases, the case enters a 14-day hold matching the statutory restore window, during which the affected user is advised to seek counsel before any restoration occurs.' },
      { heading: '4. Repeat Infringers & False Claims', body: 'Knowingly material misrepresentations in takedown notices may create liability for damages, including costs and attorneys\' fees, under 17 U.S.C. § 512(f). Accounts that repeatedly file abusive or fraudulent claims through the Service may be terminated.' },
      { heading: '5. Evidence Preservation', body: 'When a takedown case is opened, the Service preserves a snapshot of the reported page and builds a cryptographic hash chain over all artifacts. This supports authenticity review if a dispute escalates. Evidence is retained for up to 2 years and is excluded from public access.' },
      { heading: '6. Contact', body: 'Copyright questions relating to Service-generated notices: dmca@enclave.app. Response target: 5 business days.' },
    ],
  },
};

function getLegalDoc(id) {
  return DOCUMENTS[id] || null;
}

function getLegalIndex() {
  return Object.values(DOCUMENTS).map((d) => ({
    id: d.id,
    title: d.title,
    version: d.version,
    updatedAt: d.updatedAt,
  }));
}

module.exports = { getLegalDoc, getLegalIndex };
