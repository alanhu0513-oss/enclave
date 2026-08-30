# Enclave — Next Phases Plan

## Status: MASTER_PLAN complete, Tier 1-2 features built, UI overhauled

---

## PHASE 1 — Complete Existing Work (1-2 days)
> Finish what's built but has no frontend

### 1.1 Identity Passport UI
- [ ] New view: `passport-view.tsx`
- [ ] Enroll form (name, email, face scan upload)
- [ ] Passport display (token, QR code, status)
- [ ] Verify page (scan QR → show passport validity)
- [ ] Revoke button with confirmation
- [ ] Add `passport` tab to sidebar (pro+ plans)

### 1.2 Bounty UI
- [ ] New view: `bounty-view.tsx`
- [ ] Enroll card (upload face, set bounty amount $1-100)
- [ ] My bounties list (status, matches, payout)
- [ ] Hunter dashboard (available bounties, scan button)
- [ ] Match confirmation flow (confirm/reject with evidence)
- [ ] Leaderboard (top hunters, earnings)
- [ ] Add `bounty` tab to sidebar (pro+ plans)

### 1.3 Frontend Error Monitoring
- [ ] Install `@sentry/react`
- [ ] Create `SentryErrorBoundary` component
- [ ] Wrap app root with error boundary
- [ ] Add Sentry to vite config for source maps
- [ ] Test: trigger error → verify it appears in Sentry

### 1.4 SEO Foundation
- [ ] Add `<title>` and `<meta description>` per route
- [ ] Open Graph tags (og:title, og:description, og:image)
- [ ] Twitter card meta tags
- [ ] JSON-LD structured data on landing page
- [ ] `robots.txt` and `sitemap.xml`
- [ ] Canonical URLs

---

## PHASE 2 — UX & Engagement (3-5 days)
> Make the app feel polished and sticky

### 2.1 Onboarding Flow
- [ ] Welcome modal on first login
- [ ] 3-step guided tour: Scan → Shields → Alerts
- [ ] Plan recommendation wizard (quiz → suggest tier)
- [ ] Progress tracker (profile, first scan, shields active)
- [ ] Skip option, never show again toggle

### 2.2 Exportable Reports
- [ ] PDF export for scan results (client-side jsPDF)
- [ ] CSV export for alerts history
- [ ] Monthly protection report (auto-generated)
- [ ] Share report link (public URL, expires in 7 days)
- [ ] Report template with branding

### 2.3 Theme System
- [ ] Dark/light theme toggle in settings
- [ ] CSS variables for both themes
- [ ] Persist preference in localStorage
- [ ] System preference detection (`prefers-color-scheme`)
- [ ] Smooth transition between themes

### 2.4 Test Coverage
- [ ] Target: 60 → 200+ tests
- [ ] Add tests for new routes (insurance, bounty, passport, watermark)
- [ ] Add integration tests for auth flow
- [ ] Add component tests for key views
- [ ] Mock API tests for frontend

---

## PHASE 3 — Growth Features (1-2 weeks)
> New capabilities that attract users

### 3.1 AI Voice Clone Detector
- [ ] Backend: `/api/detect/voice-clone` endpoint
- [ ] Real-time audio analysis (WebRTC integration)
- [ ] Voice enrollment (store voice fingerprint)
- [ ] Background monitoring during calls
- [ ] Alert on suspicious voice patterns
- [ ] Integration with Video Call Shield extension

### 3.2 Deepfake Radar (Social Feed)
- [ ] Browser extension for Instagram/TikTok/Twitter
- [ ] Real-time scoring of images in feed
- [ ] Overlay badges (safe/suspicious/fake)
- [ ] Community reporting button
- [ ] Historical tracking of flagged content
- [ ] Dashboard for social monitoring stats

### 3.3 Digital Estate Protection
- [ ] Deceased member identity monitoring
- [ ] Estate administrator role (family plan)
- [ ] Post-mortem takedown authority
- [ ] Memorialization request flow
- [ ] Legal documentation generation
- [ ] Integration with family dashboard

### 3.4 Activity Timeline
- [ ] New view: `activity-view.tsx`
- [ ] Chronological feed of all actions
- [ ] Scan results, alerts, takedowns, shield changes
- [ ] Filter by type, date, severity
- [ ] Export timeline as PDF
- [ ] Real-time updates via polling

---

## PHASE 4 — Enterprise & Scale (2-3 weeks)
> Revenue-generating features

### 4.1 Enterprise SSO
- [ ] SAML 2.0 integration
- [ ] OIDC support
- [ ] SCIM user provisioning
- [ ] Admin console for user management
- [ ] Custom audit log retention
- [ ] Dedicated support channel setup

### 4.2 API Platform
- [ ] API key management dashboard
- [ ] Usage analytics per key
- [ ] Webhook configuration UI
- [ ] SDK generation (Python, Node, Go)
- [ ] Postman collection
- [ ] Rate limit dashboard per key

### 4.3 Mobile Apps
- [ ] iOS app (Capacitor build)
- [ ] Android app (Capacitor build)
- [ ] Push notification optimization
- [ ] Offline mode for cached scans
- [ ] Biometric unlock
- [ ] App Store / Play Store submission

### 4.4 Advanced ML
- [ ] Custom model training pipeline
- [ ] Transfer learning for new deepfake types
- [ ] Model versioning and A/B testing
- [ ] Accuracy benchmarks dashboard
- [ ] User-contributed training data (opt-in)

---

## PHASE 5 — Polish & Launch (2-3 weeks)
> Ready for public launch

### 5.1 Landing Page polish
- [ ] Blog section (5 starter posts)
- [ ] Case studies (3 fake but realistic)
- [ ] Comparison pages vs competitors
- [ ] Video demo section
- [ ] Interactive feature showcase

### 5.2 Security Hardening
- [ ] Penetration testing (self-assessment)
- [ ] Dependency vulnerability scanning (npm audit)
- [ ] CSP headers optimization
- [ ] CORS policy review
- [ ] Input sanitization audit

### 5.3 Performance
- [ ] Image lazy loading optimization
- [ ] Service worker caching
- [ ] CDN for static assets
- [ ] Database query optimization
- [ ] Bundle analysis and tree shaking

### 5.4 Accessibility
- [ ] WCAG 2.1 AA compliance audit
- [ ] Screen reader optimization
- [ ] Keyboard navigation for all views
- [ ] High contrast mode
- [ ] Reduced motion mode

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
  │         │         │         │         │
  │         │         │         │         └── Launch ready
  │         │         │         └── Enterprise features
  │         │         └── New growth features
  │         └── UX polish and engagement
  └── Complete existing backend work
```

## Estimated Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 1-2 days | Complete Passport UI, Bounty UI, Sentry, SEO |
| Phase 2 | 3-5 days | Onboarding, reports, themes, tests |
| Phase 3 | 1-2 weeks | Voice detector, social radar, estate, timeline |
| Phase 4 | 2-3 weeks | Enterprise SSO, API platform, mobile, ML |
| Phase 5 | 2-3 weeks | Landing polish, security, performance, a11y |
| **Total** | **6-9 weeks** | Full buildout before launch |

---

## Files to Create/Modify

### Phase 1
- `frontend-react/src/features/passport/passport-view.tsx` (NEW)
- `frontend-react/src/features/bounty/bounty-view.tsx` (NEW)
- `frontend-react/src/components/sentry-error-boundary.tsx` (NEW)
- `frontend-react/src/lib/seo.ts` (NEW)
- `frontend-react/index.html` (modify meta tags)
- `frontend-react/public/robots.txt` (NEW)
- `frontend-react/public/sitemap.xml` (NEW)

### Phase 2
- `frontend-react/src/features/onboarding/welcome-modal.tsx` (NEW)
- `frontend-react/src/features/onboarding/guided-tour.tsx` (NEW)
- `frontend-react/src/features/reports/pdf-export.ts` (NEW)
- `frontend-react/src/features/reports/csv-export.ts` (NEW)
- `frontend-react/src/components/theme-toggle.tsx` (NEW)
- `frontend-react/src/lib/theme.ts` (NEW)
- `backend/src/__tests__/` (multiple new test files)

### Phase 3
- `backend/src/routes/voice-clone.js` (NEW)
- `backend/src/services/voice-analyzer.js` (NEW)
- `extension/radar/manifest.json` (NEW)
- `extension/radar/content.js` (NEW)
- `frontend-react/src/features/estate/estate-view.tsx` (NEW)
- `frontend-react/src/features/activity/activity-view.tsx` (NEW)

### Phase 4
- `backend/src/routes/saml.js` (NEW)
- `backend/src/routes/api-keys.js` (NEW)
- `frontend-react/src/features/api-platform/api-dashboard.tsx` (NEW)
- `frontend-react/src/features/enterprise/sso-settings.tsx` (NEW)
- `ios/` (Capacitor iOS project)
- `android/` (Capacitor Android project)

### Phase 5
- `frontend-react/src/features/blog/blog-list.tsx` (NEW)
- `frontend-react/src/pages/case-studies.tsx` (NEW)
- `frontend-react/src/pages/comparison.tsx` (NEW)
- `frontend-react/public/.well-known/security.txt` (NEW)
