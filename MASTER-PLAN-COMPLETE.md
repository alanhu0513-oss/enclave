# ENCLAVE — Master Plan to 100% Completion

**Current state:** ~75% feature-complete. Core detection/takedown pipeline is solid.  
**Goal:** Ship every remaining feature, fix every mock, harden security, and launch as a production-grade platform.

---

## Phase 1: Data Foundation (PostgreSQL Migration)
*Everything depends on this. LowDB/JSON/in-memory data = data loss on restart.*

### 1.1 Database Schema Expansion
- [ ] Create `shield_stats` table (user_id, events_blocked, threats_detected, score, etc.)
- [ ] Create `voice_analyses` table (user_id, audio_hash, clone_score, breathing_score, created_at)
- [ ] Create `ioc_indicators` table (type, value, threat, severity, confidence, reports, region, first_seen, last_seen, verified)
- [ ] Create `ml_models` table (id, name, version, status, accuracy, trained_at, deployed_at, model_path)
- [ ] Create `ml_benchmarks` table (model_id, dataset, accuracy, precision, recall, f1, run_at)
- [ ] Create `ml_ab_tests` table (model_a, model_b, traffic_split, metric, winner, status)
- [ ] Create `bug_bounty_vulns` table (id, title, severity, reporter, status, submitted_at, resolved_at)
- [ ] Create `bug_bounty_leaderboard` table (researcher_id, vulns_found, total_bounty, rank)
- [ ] Create `education_tutorials` table (id, title, category, difficulty, steps JSON, completions)
- [ ] Create `education_certs` table (id, name, requirements JSON, holders)
- [ ] Create `blog_posts` table (id, title, content, author, category, featured, published_at)
- [ ] Create `insurance_plans` table (id, name, price, coverage, features JSON)
- [ ] Create `api_usage_logs` already exists — verify per-key aggregation works
- [ ] Create `biometric_vault` table (user_id, type, encrypted_data, iv, salt, created_at) — E2E encrypted

### 1.2 Data Migration Scripts
- [ ] Write migration: `shield_stats` Map → PostgreSQL
- [ ] Write migration: `iocDatabase` array → PostgreSQL
- [ ] Write migration: `modelRegistry` + `benchmarks` → PostgreSQL
- [ ] Write migration: `vulnerabilities` + `leaderboard` → PostgreSQL
- [ ] Write migration: `tutorials` + `certifications` + `blogPosts` → PostgreSQL
- [ ] Write migration: `INSURANCE_PLANS` → PostgreSQL
- [ ] Write migration: in-memory `passwordResetCodes` → PostgreSQL (with TTL)
- [ ] Write migration: in-memory `mockSubscriptions` → PostgreSQL (for mock mode)

### 1.3 Route Refactoring
- [ ] `shields.js` — replace Map reads/writes with DB queries
- [ ] `threat-intel.js` — replace `iocDatabase` array with DB queries
- [ ] `ml.js` — replace hardcoded arrays with DB queries
- [ ] `bug-bounty.js` — replace hardcoded arrays with DB queries
- [ ] `education.js` — replace hardcoded arrays with DB queries
- [ ] `insurance.js` — replace hardcoded `INSURANCE_PLANS` with DB queries
- [ ] `voice-clone.js` — persist analysis results to DB, compute real stats
- [ ] `auth.js` — move password reset codes to DB with TTL
- [ ] `organizations.js` — move invite codes to DB with uniqueness check

**Estimated effort:** 3-4 days  
**Dependencies:** None  
**Verification:** All 99 tests still pass after migration

---

## Phase 2: Security Hardening
*Make the platform production-safe before adding features.*

### 2.1 Cryptographic Fixes
- [ ] `auth.js:147` — replace `Math.random()` with `crypto.randomInt()` for password reset codes
- [ ] `organizations.js:23,172` — replace `Math.random().toString(36)` with `crypto.randomBytes(8).toString('hex')`
- [ ] `community.js:23-28` — replace `Math.random()` with `crypto.randomBytes` + uniqueness check
- [ ] `bounty.js:80` — remove `Math.random()` confidence (will be replaced by real ML in Phase 5)

### 2.2 E2E Biometric Encryption
- [ ] Create `services/biometric-encryption.js` — AES-256-GCM encryption for faceprints/voiceprints
- [ ] Key derivation: PBKDF2 from user password + server salt
- [ ] Encrypt before storage, decrypt on verification
- [ ] Migrate existing biometric data to encrypted format
- [ ] Add key rotation support

### 2.3 Security Headers & CSP
- [ ] Enable CSP in Helmet (currently `contentSecurityPolicy: false`)
- [ ] Define CSP directives for React SPA + inline styles + Recharts
- [ ] Add `X-Permitted-Cross-Domain-Policies: none`
- [ ] Add `Cross-Origin-Embedder-Policy: require-corp`
- [ ] Add `Cross-Origin-Opener-Policy: same-origin`
- [ ] Verify HSTS max-age ≥ 31536000

### 2.4 Dependency Security
- [ ] Run `npm audit` in backend — fix all critical/high vulnerabilities
- [ ] Run `npm audit` in frontend — fix all critical/high vulnerabilities
- [ ] Run `npm audit` in root — remove stale duplicate `package.json`
- [ ] Add `npm audit` to CI pipeline
- [ ] Pin all dependency versions in `package.json`

### 2.5 Penetration Testing
- [ ] Test SQL injection on all DB query endpoints
- [ ] Test XSS on all user-input fields (search, chat, reports)
- [ ] Test JWT manipulation (expired, tampered, wrong secret)
- [ ] Test rate limiting bypass (X-Forwarded-For, X-Real-IP)
- [ ] Test file upload vulnerabilities (malicious images, oversized files)
- [ ] Test SSRF via URL scan endpoint
- [ ] Test path traversal on file serving
- [ ] Document findings and fix all critical/high issues

**Estimated effort:** 2-3 days  
**Dependencies:** Phase 1 (DB for password reset codes)  
**Verification:** npm audit clean, CSP headers verified, all tests pass

---

## Phase 3: Real-Time Infrastructure
*WebSocket + job queue = foundation for live features.*

### 3.1 WebSocket Threat Stream
- [ ] Install `ws` (WebSocket library) in backend
- [ ] Create `services/websocket.js` — WebSocket server on same HTTP server
- [ ] Auth middleware: verify JWT on WebSocket connection
- [ ] Channel system: user-specific channels, family channels, org channels
- [ ] Event types: `alert.new`, `alert.updated`, `takedown.status`, `monitoring.event`, `threat.intel`
- [ ] Heartbeat/ping-pong for connection health
- [ ] Reconnection with exponential backoff on client

### 3.2 Background Job Queue
- [ ] Install `bullmq` + Redis connection
- [ ] Create `services/job-queue.js` — queue manager
- [ ] Job types:
  - `monitoring.scan` — run crawler for a user's identity
  - `takedown.followup` — 48h escalation check
  - `weekly.digest` — send weekly email summary
  - `threat.intel.sync` — sync IOCs from community
  - `biometric.retrain` — trigger model retraining
- [ ] Job prioritization (critical > high > normal > low)
- [ ] Job retry with exponential backoff
- [ ] Job failure alerting (email + notification)

### 3.3 Redis Setup
- [ ] Add Redis to `docker-compose.yml` (port 6379)
- [ ] Configure connection pooling
- [ ] Add Redis health check endpoint
- [ ] Use Redis for: job queue, WebSocket pub/sub, rate limit counters, session cache

### 3.4 Client Real-Time Integration
- [ ] Create `lib/websocket.ts` — WebSocket client with auto-reconnect
- [ ] Integrate into `AppContext` — real-time notification updates
- [ ] Add real-time alert badges (no page refresh needed)
- [ ] Add real-time monitoring status updates
- [ ] Add real-time takedown status updates

**Estimated effort:** 3-4 days  
**Dependencies:** None  
**Verification:** WebSocket connects, jobs execute, Redis health check passes

---

## Phase 4: Browser Extension (Deepfake Radar)
*The flagship feature. Real-time protection as users browse.*

### 4.1 Extension Architecture
- [ ] Create `extension/` directory at repo root
- [ ] `manifest.json` — Manifest V3, permissions: `activeTab`, `storage`, `identity`, `tabs`
- [ ] Content scripts: inject on social media domains
- [ ] Background service worker: persistent monitoring
- [ ] Side panel: threat feed + alerts
- [ ] Popup: quick stats + toggle

### 4.2 Content Scripts (Image/Video Detection)
- [ ] Detect `<img>` and `<video>` elements on page
- [ ] Extract image source URLs
- [ ] Send to backend `/api/detect/image` for analysis
- [ ] Show overlay shield icon on suspicious media
- [ ] Confidence score tooltip on hover
- [ ] One-click "Report" button in overlay
- [ ] MutationObserver for dynamically loaded content (infinite scroll)

### 4.3 Background Service Worker
- [ ] Monitor followed accounts (user config)
- [ ] Periodic scan of recent posts from followed accounts
- [ ] Store scan results in `chrome.storage.local`
- [ ] Badge counter for new threats
- [ ] Push notifications for critical threats
- [ ] Auto-takedown initiation (user-configurable)

### 4.4 Side Panel UI
- [ ] React app (bundled separately)
- [ ] Threat feed with filters (severity, type, date)
- [ ] Alert detail view with evidence
- [ ] Quick actions: whitelist, report, takedown
- [ ] Settings: followed accounts, notification preferences
- [ ] Stats: scans today, threats found, actions taken

### 4.5 Extension Backend API
- [ ] `POST /api/extension/register` — register extension instance
- [ ] `POST /api/extension/scan` — batch image scan
- [ ] `GET /api/extension/feed` — threat feed for extension
- [ ] `POST /api/extension/report` — quick report from extension
- [ ] `GET /api/extension/stats` — user's extension stats

### 4.6 Chrome Web Store Preparation
- [ ] Extension screenshots (1280x800, 640x400)
- [ ] Store listing copy (description, category, language)
- [ ] Privacy policy for extension
- [ ] Extension review compliance check
- [ ] Bundle size optimization (< 5MB)

**Estimated effort:** 5-7 days  
**Dependencies:** Phase 3 (WebSocket for real-time alerts)  
**Verification:** Extension loads in Chrome, detects images on Twitter/Facebook/Instagram, shows overlays

---

## Phase 5: Video Call Shield (WebRTC Protector)
*Real-time deepfake detection during live video calls.*

### 5.1 WebRTC Integration
- [ ] Content script injection into Google Meet, Zoom, WhatsApp Web, Microsoft Teams
- [ ] Capture video frame from `<video>` element (canvas snapshot)
- [ ] Capture audio from `AudioContext` (Web Audio API)
- [ ] Frame sampling: analyze every N seconds (configurable, default 5s)

### 5.2 Real-Time Face Analysis
- [ ] Send captured frame to backend `/api/detect/image` (or local ONNX)
- [ ] Track face consistency across frames (identity drift detection)
- [ ] Detect face swap artifacts (edge blending, lighting inconsistency)
- [ ] Detect face reenactment (expression manipulation)
- [ ] Confidence threshold: alert at >70% clone probability

### 5.3 Camera Watermarking
- [ ] Inject invisible watermark into camera feed before WebRTC encoding
- [ ] Watermark contains: user_id, timestamp, session_id
- [ ] Uses LSB steganography (existing watermark service)
- [ ] Toggle on/off in extension settings
- [ ] Verify watermark on receiving end (optional)

### 5.4 Audio Voice Clone Detection
- [ ] Capture audio samples during call
- [ ] Send to `/api/detect/audio` endpoint
- [ ] Track voice consistency across call duration
- [ ] Alert on voice clone indicators (spectral anomalies, breathing pattern mismatches)

### 5.5 Call Shield UI
- [ ] Floating overlay during calls (position: top-right)
- [ ] Real-time status indicator: green (safe) / yellow (analyzing) / red (threat detected)
- [ ] Expandable panel with:
  - Face match confidence per participant
  - Voice analysis status
  - Session recording indicator
  - One-click "End Call" / "Report" buttons
- [ ] Settings: sensitivity level, auto-alert, recording preference

### 5.6 Call Session Logging
- [ ] Log each call session (participants, duration, threats detected)
- [ ] Store evidence frames (encrypted)
- [ ] Generate call security report
- [ ] Integrate with takedown pipeline for post-call threats

**Estimated effort:** 5-7 days  
**Dependencies:** Phase 4 (extension architecture), Phase 3 (WebSocket for real-time)  
**Verification:** Extension detects deepfake face swap in a test Google Meet call

---

## Phase 6: Enterprise Features (B2B Revenue)
*Real SSO, real provisioning, real admin controls.*

### 6.1 Real SAML Integration
- [ ] Install `saml2-js` or `passport-saml`
- [ ] `services/sso.js` — replace mock callback with real SAML validation
  - XML signature validation against IdP certificate
  - Assertion decryption
  - Attribute extraction (email, name, groups)
  - Audience restriction validation
  - Conditions/not-before/not-on-or-after validation
- [ ] `routes/sso.js` — real ACS endpoint
- [ ] Test with: Okta, Azure AD, OneLogin, Google Workspace

### 6.2 Real OIDC Integration
- [ ] Install `openid-client`
- [ ] `services/sso.js` — replace mock callback with real OIDC flow
  - Authorization code → token exchange
  - ID token JWT validation (signature, nonce, issuer, audience)
  - JWKS fetching and caching
  - Claims mapping (sub, email, name, groups)
- [ ] `routes/sso.js` — real callback endpoint
- [ ] Test with: Okta, Auth0, Google, Azure AD

### 6.3 SCIM Provisioning
- [ ] Implement SCIM 2.0 `/Users` and `/Groups` endpoints
- [ ] Auto-provision users on SSO login
- [ ] Auto-deprovision on IdP group removal
- [ ] Attribute sync (name, email, role, department)
- [ ] Webhook for provisioning events

### 6.4 Organization Admin Dashboard
- [ ] Member management (invite, remove, role assignment)
- [ ] SSO configuration wizard (metadata URL, certificate upload)
- [ ] Audit log viewer (who did what, when)
- [ ] Usage analytics per member
- [ ] Billing management (upgrade, invoice history)
- [ ] Policy configuration (enforce 2FA, session timeout, IP whitelist)

### 6.5 Enterprise API
- [ ] `GET /api/enterprise/members` — list org members
- [ ] `POST /api/enterprise/members/invite` — invite member
- [ ] `DELETE /api/enterprise/members/:id` — remove member
- [ ] `GET /api/enterprise/audit-log` — audit events
- [ ] `GET /api/enterprise/usage` — org-wide usage stats
- [ ] `POST /api/enterprise/sso/configure` — save SSO config
- [ ] `POST /api/enterprise/sso/test` — test SSO connection (real)

### 6.6 White-Label Support
- [ ] Custom branding (logo, colors, domain)
- [ ] Custom email templates
- [ ] Custom report templates
- [ ] Embeddable widget for customer-facing apps

**Estimated effort:** 5-7 days  
**Dependencies:** Phase 1 (DB for audit logs), Phase 2 (security)  
**Verification:** SSO login works with Okta test account, audit log records events

---

## Phase 7: AI/ML Pipeline (Custom Training)
*Real model management, real benchmarks, real A/B testing.*

### 7.1 Model Registry (Real)
- [ ] `ml.js` — replace hardcoded `modelRegistry` with DB queries
- [ ] Model upload endpoint (ONNX file upload to S3/local storage)
- [ ] Model metadata: name, version, architecture, training data, accuracy, size
- [ ] Model lifecycle: draft → staging → production → archived
- [ ] Deployment: hot-swap model in Python ML service (reload ONNX)

### 7.2 Benchmark Tracking
- [ ] Store evaluation results per model version
- [ ] Datasets: standard deepfake detection benchmarks (FaceForensics++, Celeb-DF, DFDC)
- [ ] Metrics: accuracy, precision, recall, F1, AUC-ROC, EER
- [ ] Comparison dashboard: model A vs model B
- [ ] Automated evaluation pipeline (run benchmark on new model version)

### 7.3 A/B Testing Framework
- [ ] Traffic splitting: percentage-based model routing
- [ ] Metric tracking: detection accuracy, false positive rate, user satisfaction
- [ ] Statistical significance testing (chi-squared, t-test)
- [ ] Auto-winner: promote winning model to production after significance reached
- [ ] Rollback: automatic rollback on accuracy degradation

### 7.4 Custom Training Pipeline
- [ ] Training data management (upload, label, split)
- [ ] Training job submission (trigger Python training script)
- [ ] Training progress monitoring (loss, accuracy curves)
- [ ] Model validation against holdout set
- [ ] Model registration on successful training

### 7.5 Federated Learning (Experimental)
- [ ] Client-side model updates (extension/mobile)
- [ ] Secure aggregation server
- [ ] Differential privacy guarantees
- [ ] Model update batching and application

**Estimated effort:** 5-7 days  
**Dependencies:** Phase 1 (DB for models), Phase 3 (job queue for training)  
**Verification:** Model uploaded, benchmarked, deployed via UI, detection uses new model

---

## Phase 8: Content & Marketing (Growth)
*Real blog, real education, real SEO.*

### 8.1 Blog CMS
- [ ] `education.js` — replace hardcoded blog posts with DB queries
- [ ] Admin blog editor (create, edit, delete, publish, unpublish)
- [ ] Rich text editor (Markdown or TipTap)
- [ ] Image upload for featured images
- [ ] SEO fields: meta title, description, canonical URL, OG image
- [ ] Draft/published/archived states
- [ ] Scheduled publishing

### 8.2 Educational Content Management
- [ ] `education.js` — replace hardcoded tutorials with DB queries
- [ ] Tutorial editor (steps, quizzes, code examples)
- [ ] Certification editor (requirements, expiry rules)
- [ ] Progress tracking per user (real completion data)
- [ ] Certificate generation (PDF with user name, date, credential ID)

### 8.3 SEO Enhancement
- [ ] Dynamic sitemap generation (from DB blog posts + pages)
- [ ] Structured data for tutorials (HowTo schema)
- [ ] Structured data for certifications (Certificate schema)
- [ ] Canonical URLs for all pages
- [ ] Open Graph images for all pages
- [ ] Twitter Card meta tags
- [ ] `robots.txt` updates (allow all, disallow /api/)

### 8.4 Developer Documentation
- [ ] API reference (auto-generated from Swagger/OpenAPI)
- [ ] Getting started guide
- [ ] Authentication guide (JWT, API keys)
- [ ] Webhook documentation
- [ ] SDK documentation (JS, Python)
- [ ] Changelog page

### 8.5 Landing Page Enhancements
- [ ] Email capture form (newsletter signup)
- [ ] Case studies section
- [ ] Customer testimonials (real or realistic)
- [ ] ROI calculator
- [ ] Demo request form
- [ ] Live chat widget (Intercom/Crisp alternative: open-source Tawk.to)

**Estimated effort:** 3-4 days  
**Dependencies:** Phase 1 (DB for blog/tutorials)  
**Verification:** Blog posts CRUD via admin, SEO audit passes, newsletter signup works

---

## Phase 9: API Platform (Developer Ecosystem)
*Real rate limiting, real webhooks, real analytics.*

### 9.1 Real Per-Key Rate Limiting
- [ ] `api-platform.js` — replace hardcoded `currentUsage: 0` with DB query
- [ ] Middleware: extract API key from `X-API-Key` header
- [ ] Query `api_usage_logs` for current period usage
- [ ] Enforce per-key limits (configurable per tier)
- [ ] Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- [ ] 429 response with retry-after

### 9.2 Real Webhook Dispatch
- [ ] `api-platform.js` — replace mock test with real `webhooks.dispatchEvent()`
- [ ] Webhook payload signing (HMAC-SHA256)
- [ ] Retry logic (3 attempts with exponential backoff)
- [ ] Webhook event types: `alert.created`, `alert.resolved`, `takedown.status`, `scan.completed`
- [ ] Webhook delivery log (success/failure, response code, latency)
- [ ] Webhook test endpoint: send real test payload

### 9.3 API Analytics Dashboard
- [ ] Request volume over time (charts)
- [ ] Error rate breakdown (4xx, 5xx)
- [ ] Latency distribution (p50, p95, p99)
- [ ] Top endpoints by usage
- [ ] API key usage breakdown
- [ ] Export to CSV

### 9.4 API Key Management
- [ ] Key generation (scoped: read-only, read-write, admin)
- [ ] Key rotation (revoke old, generate new)
- [ ] Key permissions (which endpoints accessible)
- [ ] Key expiration (optional)
- [ ] Key usage history

### 9.5 Developer Portal
- [ ] API playground (try endpoints in browser)
- [ ] Interactive docs (Swagger UI or Redoc)
- [ ] Code examples (cURL, Python, JavaScript)
- [ ] Webhook simulator
- [ ] Status page integration

**Estimated effort:** 3-4 days  
**Dependencies:** Phase 1 (DB), Phase 3 (Redis for rate limiting)  
**Verification:** API key rate limiting enforced, webhook sends real HTTP request

---

## Phase 10: Compliance & Certification
*Enterprise trust requirements.*

### 10.1 SOC 2 Type II Preparation
- [ ] Document all security controls
- [ ] Access control audit (who can access what)
- [ ] Data encryption at rest (AES-256) and in transit (TLS 1.3)
- [ ] Incident response plan
- [ ] Business continuity plan
- [ ] Vendor management (third-party dependencies)
- [ ] Employee security training documentation

### 10.2 GDPR Compliance
- [ ] Cookie consent banner (essential, analytics, marketing)
- [ ] Privacy policy page (auto-generated from data processing activities)
- [ ] Terms of service page
- [ ] Data Subject Access Request (DSAR) endpoint
- [ ] Right to erasure (account deletion + data purge)
- [ ] Data portability (export all user data as JSON/CSV)
- [ ] Data processing agreements (DPA) for sub-processors
- [ ] Privacy impact assessment document

### 10.3 CCPA Compliance
- [ ] "Do Not Sell My Personal Information" link
- [ ] Opt-out mechanism
- [ ] Annual data collection disclosure
- [ ] Financial incentive disclosure (if applicable)

### 10.4 WCAG 2.1 AA Accessibility
- [ ] Automated audit (axe-core)
- [ ] Keyboard navigation test (all interactive elements reachable)
- [ ] Screen reader test (NVDA/VoiceOver)
- [ ] Color contrast check (4.5:1 minimum)
- [ ] Focus indicators on all interactive elements
- [ ] Alt text on all images
- [ ] ARIA labels on all icons/buttons
- [ ] Skip navigation link
- [ ] Form error announcements
- [ ] Accessible modal dialogs

### 10.5 Security Audit Documentation
- [ ] Penetration test report
- [ ] Vulnerability disclosure policy
- [ ] Bug bounty program terms (real, not mock)
- [ ] Security contact email (security@enclave.app)
- [ ] CVE disclosure process

**Estimated effort:** 3-4 days  
**Dependencies:** Phase 2 (security hardening), Phase 6 (enterprise features)  
**Verification:** WCAG audit passes, GDPR endpoints functional, security docs complete

---

## Phase 11: Mobile & Performance
*App Store ready, fast everywhere.*

### 11.1 iOS App Store Submission
- [ ] Fix all Capacitor build warnings
- [ ] App Store screenshots (6.7", 6.5", 5.5" iPhones)
- [ ] App Store preview video (15-30s)
- [ ] App Store listing (title, subtitle, description, keywords)
- [ ] Privacy nutrition labels
- [ ] App privacy policy URL
- [ ] Age rating questionnaire
- [ ] In-app purchase configuration (if applicable)
- [ ] Submit for review

### 11.2 Google Play Store Submission
- [ ] Play Store screenshots (phone, tablet)
- [ ] Play Store listing (title, short description, full description)
- [ ] Content rating questionnaire
- [ ] Data safety section
- [ ] Target audience and content declaration
- [ ] Internal testing track → closed testing → open testing → production
- [ ] Submit for review

### 11.3 Offline Mode
- [ ] Service worker caching (static assets, API responses)
- [ ] IndexedDB for offline data storage
- [ ] Offline detection UI (banner, retry)
- [ ] Queue actions for sync when online
- [ ] Background sync for pending scans

### 11.4 Performance Optimization
- [ ] Code splitting per route (lazy loading)
- [ ] Bundle analysis (identify large dependencies)
- [ ] Image optimization (WebP, lazy loading, responsive srcset)
- [ ] Font subsetting (only used characters)
- [ ] Prefetching critical resources
- [ ] HTTP/2 server push for critical assets
- [ ] CDN for static assets (Cloudflare/AWS CloudFront)
- [ ] Lighthouse audit (target: Performance >90, Accessibility >95)

### 11.5 Push Notifications (Real)
- [ ] Configure FCM server key in production
- [ ] iOS APNs configuration
- [ ] Push notification templates
- [ ] Notification categories (alert, takedown, system)
- [ ] Deep linking from notifications to specific views
- [ ] Notification preferences per category

**Estimated effort:** 4-5 days  
**Dependencies:** Phase 3 (real-time for push), Phase 10 (compliance for store submission)  
**Verification:** App builds, passes store review, Lighthouse score >90

---

## Phase 12: CI/CD & Operations
*Production-grade deployment pipeline.*

### 12.1 GitHub Actions CI
- [ ] `.github/workflows/ci.yml`
- [ ] Trigger: push to main, PR to main
- [ ] Jobs:
  - Lint (eslint)
  - Type check (tsc --noEmit)
  - Test (jest --coverage)
  - Build (vite build)
  - Security audit (npm audit)
- [ ] Fail fast on any job failure
- [ ] Status badge in README

### 12.2 Staging Environment
- [ ] Separate Railway service for staging
- [ ] Separate Vercel project for staging
- [ ] Staging database (separate PostgreSQL instance)
- [ ] Deploy staging on push to `develop` branch
- [ ] Manual promotion to production

### 12.3 Deployment Pipeline
- [ ] Deploy backend to Railway on merge to main
- [ ] Deploy frontend to Vercel on merge to main
- [ ] Database migration on deploy (if needed)
- [ ] Post-deploy health check
- [ ] Rollback on failure

### 12.4 Monitoring & Alerting
- [ ] Sentry error tracking (already configured — verify)
- [ ] Uptime monitoring (BetterStack or UptimeRobot)
- [ ] Error rate alerting (email when 5xx > 5% for 5 min)
- [ ] Latency alerting (p99 > 2s for 5 min)
- [ ] Disk space alerting
- [ ] Memory usage alerting

### 12.5 Incident Response
- [ ] Incident response runbook
- [ ] On-call rotation (if team)
- [ ] Status page (status.enclave.app)
- [ ] Post-incident review template
- [ ] Communication templates (email, social, status page)

### 12.6 Backup & Recovery
- [ ] Automated PostgreSQL backups (daily, retain 30 days)
- [ ] Backup verification (monthly restore test)
- [ ] Recovery time objective (RTO): 4 hours
- [ ] Recovery point objective (RPO): 1 hour
- [ ] Disaster recovery plan document

**Estimated effort:** 2-3 days  
**Dependencies:** All previous phases  
**Verification:** CI passes, staging deploy works, monitoring alerts fire correctly

---

## Phase 13: Final Integration & Polish
*Everything working together.*

### 13.1 End-to-End Testing
- [ ] User registration → onboarding → scan → alert → takedown flow
- [ ] Family member invite → shared monitoring flow
- [ ] Enterprise SSO → member invite → audit log flow
- [ ] API key creation → scan → webhook delivery flow
- [ ] Extension install → image detection → report flow
- [ ] Video call → deepfake detection → alert flow
- [ ] Billing upgrade → feature unlock flow

### 13.2 Cross-Feature Integration
- [ ] Alert → takedown → evidence → report (full pipeline)
- [ ] Crawler → detection → alert → notification (real-time)
- [ ] Community threat → IOC → global protection
- [ ] Family monitoring → consolidated alerts
- [ ] API scan → webhook → third-party integration
- [ ] Extension → backend → mobile push notification

### 13.3 Performance Load Testing
- [ ] k6 load test: 100 concurrent users
- [ ] k6 load test: 1000 concurrent users
- [ ] Database query performance (explain analyze all slow queries)
- [ ] WebSocket connection limit test
- [ ] CDN cache hit ratio optimization

### 13.4 Documentation Finalization
- [ ] README.md — comprehensive setup, architecture, contributing guide
- [ ] CONTRIBUTING.md — code style, PR process, commit conventions
- [ ] CHANGELOG.md — all changes from Phase 1-13
- [ ] SECURITY.md — vulnerability disclosure, security policy
- [ ] LICENSE — MIT or appropriate license

### 13.5 Launch Preparation
- [ ] Production environment variables audit
- [ ] SSL certificate verification
- [ ] DNS configuration (enclave.app, api.enclave.app, status.enclave.app)
- [ ] Email deliverability (SPF, DKIM, DMARC)
- [ ] Social media accounts (Twitter, LinkedIn, GitHub)
- [ ] Product Hunt launch draft
- [ ] Hacker News "Show HN" draft
- [ ] Press kit (logo, screenshots, copy)

**Estimated effort:** 3-4 days  
**Dependencies:** All previous phases  
**Verification:** All E2E tests pass, load test passes, docs complete

---

## Summary

| Phase | Name | Effort | Dependencies |
|-------|------|--------|-------------|
| 1 | Data Foundation | 3-4 days | None |
| 2 | Security Hardening | 2-3 days | Phase 1 |
| 3 | Real-Time Infrastructure | 3-4 days | None |
| 4 | Browser Extension | 5-7 days | Phase 3 |
| 5 | Video Call Shield | 5-7 days | Phase 4 |
| 6 | Enterprise Features | 5-7 days | Phase 1, 2 |
| 7 | AI/ML Pipeline | 5-7 days | Phase 1, 3 |
| 8 | Content & Marketing | 3-4 days | Phase 1 |
| 9 | API Platform | 3-4 days | Phase 1, 3 |
| 10 | Compliance | 3-4 days | Phase 2, 6 |
| 11 | Mobile & Performance | 4-5 days | Phase 3, 10 |
| 12 | CI/CD & Operations | 2-3 days | All |
| 13 | Final Integration | 3-4 days | All |
| **Total** | | **46-62 days** | |

### Critical Path
```
Phase 1 → Phase 2 → Phase 6 → Phase 10 → Phase 11 → Phase 12 → Phase 13
Phase 1 → Phase 3 → Phase 4 → Phase 5 → Phase 13
Phase 1 → Phase 3 → Phase 7 → Phase 13
Phase 1 → Phase 8 → Phase 13
Phase 1 → Phase 3 → Phase 9 → Phase 13
```

### Parallelizable Tracks
- **Track A (Data):** Phase 1 → Phase 2 → Phase 6 → Phase 10
- **Track B (Real-Time):** Phase 3 → Phase 4 → Phase 5
- **Track C (AI):** Phase 3 → Phase 7
- **Track D (Content):** Phase 1 → Phase 8
- **Track E (API):** Phase 1 → Phase 3 → Phase 9

### Risk Areas
1. **Phase 4+5 (Extension):** Chrome Web Store review can take 1-2 weeks. Submit early.
2. **Phase 6 (SSO):** Testing with real IdP requires sandbox accounts (Okta developer, Azure trial).
3. **Phase 10 (Compliance):** SOC 2 audit requires third-party auditor (expensive, time-consuming).
4. **Phase 11 (App Stores):** iOS review can reject for various reasons. Budget 2-3 submission attempts.

### Definition of "100% Complete"
The platform is 100% complete when:
- [ ] Zero mocked/stubbed functionality (everything real or behind feature flag)
- [ ] Zero `Math.random()` used for security-sensitive operations
- [ ] All data persisted to PostgreSQL (no in-memory Maps for critical data)
- [ ] Browser extension detecting real deepfakes on social media
- [ ] Video call shield protecting live calls
- [ ] Enterprise SSO working with Okta/Azure AD
- [ ] Real-time WebSocket threat stream operational
- [ ] API platform with real rate limiting and webhooks
- [ ] GDPR endpoints functional (data export, deletion)
- [ ] WCAG 2.1 AA accessibility audit passed
- [ ] iOS + Android apps submitted to stores
- [ ] CI/CD pipeline running on every commit
- [ ] Monitoring and alerting operational
- [ ] Documentation complete
- [ ] Load test passes (1000 concurrent users)
- [ ] Security audit passed
