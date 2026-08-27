# Enclave Platform Build Plan

## Overview
Complete overhaul of Enclave from a partially-wired prototype to a fully-functional identity protection platform. 6 phases, each delivering a vertical slice of value. All $0 budget, using existing infrastructure (Suga backend, Vercel frontend, PostgreSQL).

---

## Phase 0: Critical Security & Infrastructure Fixes
**Goal:** Make existing features actually work in production

### 0.1 Stripe Webhook Security
- Remove unauthenticated `/api/billing/webhook-fallback` route
- Ensure only the raw-mounted `/api/billing/webhook` in index.js is accessible
- File: `backend/src/routes/billing.js`

### 0.2 PostgreSQL Billing Columns
- Add migration to `init.sql`: `subscription_tier`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_current_period_end` on `users` table
- Update `billing.js` service to read/write these columns
- Files: `backend/src/db/init.sql`, `backend/src/services/billing.js`

### 0.3 Faceprints Embedding Column
- Add `embedding_json TEXT` column to `faceprints` table
- Update biometrics route to store embedding after face scan
- Update crawler face-match to read stored embedding
- Files: `backend/src/db/init.sql`, `backend/src/routes/biometrics.js`, `backend/src/services/crawler.js`

### 0.4 Tier Enforcement
- Wire `usage.checkLimit()` into every route that consumes resources:
  - `alerts/scan/url` → check scans limit
  - `alerts/scan/image` → check scans limit
  - `alerts/deep-scan` → check scans limit
  - `takedowns/:alertId/initiate` → check takedowns limit
  - `detect/*` → check apiCalls limit
- Return `429` with upgrade prompt when limit hit
- Files: `backend/src/routes/alerts.js`, `backend/src/routes/takedowns.js`, `backend/src/routes/detect.js`, `backend/src/services/usage.js`

### 0.5 Fix Password Reset Email
- Wire `nodemailer` to send actual emails with reset codes
- Use Gmail SMTP (existing nodemailer config in services)
- Files: `backend/src/routes/auth.js`, `backend/src/services/notifications.js`

### 0.6 Fix Notification Crash
- Handle relative `source_url` paths in `notifications.js` (uploaded images)
- Wrap `new URL()` in try/catch or check for relative paths
- File: `backend/src/services/notifications.js`

### 0.7 Fix monitoring_state Schema
- Align `monitoring-service.js` column writes with actual `init.sql` columns
- Add `sources_health TEXT` column or map to existing columns
- Files: `backend/src/db/init.sql`, `backend/src/services/monitoring-service.js`

---

## Phase 1: Onboarding & Real-Time Feedback
**Goal:** First-time users get guided setup, all actions feel alive

### 1.1 Onboarding Wizard (3-step)
- **Step 1:** Upload a selfie → face enrollment (uses existing biometrics API)
- **Step 2:** Scan one image or URL → first detection result
- **Step 3:** Dashboard tour → show what each tab does
- Store `onboarding_completed` flag in localStorage + user record
- Show wizard on first login, skip button available
- Files: `frontend/index.html` (new overlay), `frontend/app.js`, `frontend/styles.css`

### 1.2 Dashboard Security Score
- Calculate real score (0-100) from weighted factors:
  - Face enrolled: +20
  - Voice enrolled: +10
  - Signature enrolled: +5
  - Camera shield active: +15
  - Voice shield active: +10
  - Crawler monitoring active: +15
  - Alerts resolved (vs total): +15
  - Takedowns completed: +10
- Replace hardcoded hero ring with live calculation
- Show score breakdown in tooltip
- Files: `frontend/app.js`, `frontend/index.html`

### 1.3 Real-Time Scan Progress
- Replace instant "Scanning..." with step-by-step progress:
  1. "Initializing ML pipeline..." (200ms)
  2. "Extracting image features..." (500ms)
  3. "Running deepfake detection..." (1s)
  4. "Checking face matches..." (500ms)
  5. "Generating report..." (300ms)
- Animated progress bar with percentage
- Each step shows spinner → checkmark on complete
- Files: `frontend/app.js`, `frontend/styles.css`, `frontend/interactions.js`

---

## Phase 2: Notification & Email Infrastructure
**Goal:** Alerts persist across devices, users get real emails

### 2.1 Server-Side Notification Queue
- Wire existing `notifications` table to store all alerts/notifications
- API endpoints already exist (`/api/notifications/*`) — verify they work
- Add notification creation to all alert-generating flows:
  - Scan completes → create notification
  - Takedown status changes → create notification
  - Shield activates/deactivates → create notification
- Frontend: poll `/api/notifications` every 30s when dashboard is open
- Files: `backend/src/services/notifications.js`, `frontend/app.js`

### 2.2 Email Digest Service
- Wire existing `digest` service to send weekly emails
- Schedule: every Monday 9am UTC
- Email content: threats detected, actions taken, security score change
- Add email preference toggle in Settings
- Files: `backend/src/services/digest.js`, `backend/src/routes/billing.js`

### 2.3 Push Notifications (FCM)
- Wire existing FCM token registration (`/api/notifications/fcm-token`)
- Send push for: critical threats, takedown completions, weekly digest
- Files: `backend/src/services/notifications.js`

---

## Phase 3: Scan History & Reports
**Goal:** Platform feels like it accumulates value over time

### 3.1 Scan History Timeline
- Store all scan results server-side (existing `alerts` table)
- Build timeline visualization:
  - Horizontal timeline with dots for each scan
  - Color-coded: green (safe), yellow (suspicious), red (threat)
  - Hover shows details, click opens full report
  - Filter by: date range, type (image/URL), result
- Add to Insights tab
- Files: `frontend/app.js`, `frontend/index.html`, `frontend/styles.css`

### 3.2 Exportable Reports (PDF)
- Wire existing `reports` table and `report_schedules`
- Generate PDF reports with:
  - Executive summary (security score, threats found, actions taken)
  - Detailed findings list
  - Timeline visualization
  - Recommendations
- Use `puppeteer` or `pdfkit` for PDF generation (both free)
- Files: `backend/src/routes/reports.js` (new), `frontend/app.js`

### 3.3 Report Scheduling
- Let users schedule weekly/monthly reports
- Email PDF as attachment
- Files: `backend/src/routes/reports.js`, `frontend/app.js`

---

## Phase 4: Advanced Detection
**Goal:** Differentiation features that justify paid plans

### 4.1 Reverse Image Search
- Upload a face photo → search across:
  - User's own monitored URLs
  - Web crawler results (DuckDuckGo, Yandex)
  - Community threat shares
- Return: all matching images with source URLs, confidence scores
- Use existing face matching + crawler infrastructure
- Files: `backend/src/routes/detect.js` (new endpoint), `frontend/app.js`

### 4.2 Identity Change Detection
- Compare enrolled face against new scans over time
- Detect: aging, deepfake manipulation, identity theft
- Alert when face match score drops below threshold
- Track face changes on timeline
- Files: `backend/src/services/crawler.js`, `backend/src/routes/biometrics.js`

### 4.3 Watermark Embedding
- Embed invisible watermarks in user's photos before sharing
- Uses LSB steganography or DWT-based watermarking
- Watermark contains: user ID, timestamp, copyright claim
- Verify watermark presence on any image
- Files: `backend/src/services/watermark.js` (new), `backend/src/routes/alerts.js`

---

## Phase 5: Family & Community
**Goal:** Multi-user protection and network effects

### 5.1 Family Protection Plan (up to 5 people)
- New table: `family_members` (owner_id, member_email, member_name, role, status)
- Owner can:
  - Add up to 5 family members
  - Assign protection profiles (full/monitoring-only/alerts-only)
  - View consolidated dashboard for all members
  - Manage takedowns on behalf of members
- Member experience:
  - Receives invite email
  - Creates own account with own biometrics
  - Owner sees their alerts (with permission)
- Billing: family plan includes 5 seats at $19.99/mo
- Files: `backend/src/routes/family.js` (new), `backend/src/db/init.sql`, `frontend/app.js`

### 5.2 Threat Intelligence Feed
- Wire existing `threat_shares` table
- Users can submit IoCs (indicators of compromise):
  - Malicious URLs
  - Deepfake images
  - Fake profiles
  - Phishing domains
- Community voting (confirm/deny)
- Feed page showing latest shared threats
- Auto-check new scans against community IoCs
- Files: `backend/src/routes/community.js`, `frontend/app.js`

### 5.3 Community Dashboard
- Show: total users, threats blocked, IoCs shared
- Leaderboard for top contributors
- Anonymized activity feed
- Files: `frontend/app.js`, `frontend/index.html`

---

## Phase 6: Revenue & Enterprise
**Goal:** Monetization infrastructure

### 6.1 White-Label for Enterprises
- Wire existing `white_label` table
- Enterprise customers can:
  - Custom logo, colors, domain
  - Branded onboarding flow
  - Custom report templates
  - SSO integration (existing `sso_configurations` table)
- Files: `backend/src/routes/white-label.js` (new), `frontend/app.js`

### 6.2 API Access for Partners
- Wire existing `otdb_api_keys` table
- Generate API keys for partners
- Rate limit per key (tier-based)
- API documentation endpoint
- Files: `backend/src/routes/api-keys.js` (new), `frontend/app.js`

### 6.3 Referral Program
- Wire existing `referrals` + `referral_redemptions` tables
- Unique referral codes per user
- Reward: 1 month free for referrer + referee
- Track referrals in dashboard
- Files: `backend/src/routes/referrals.js` (new), `frontend/app.js`

---

## Execution Order

| Phase | Depends On | Estimated Effort | Priority |
|-------|-----------|-----------------|----------|
| 0 | None | 2-3 hours | CRITICAL |
| 1 | Phase 0 | 3-4 hours | HIGH |
| 2 | Phase 0 | 2-3 hours | HIGH |
| 3 | Phase 0, 2 | 3-4 hours | HIGH |
| 4 | Phase 0 | 4-5 hours | MEDIUM |
| 5 | Phase 0, 2 | 4-5 hours | MEDIUM |
| 6 | Phase 0 | 3-4 hours | LOW (revenue) |

**Total estimated: 21-28 hours of focused work**

---

## Technical Decisions

- **PDF generation:** `pdfkit` (lightweight, no headless browser needed)
- **Watermarking:** Canvas-based LSB steganography (runs in-browser for preview, server for production)
- **Email:** Nodemailer + Gmail SMTP (existing config)
- **Push:** Firebase Cloud Messaging (existing config)
- **Charts:** Chart.js via CDN (lightweight, no build step)
- **Timeline:** Custom CSS + JS (no library needed)
- **Family plan:** Row-level security via `user_id` foreign keys
- **API keys:** UUID v4 + `sha256` hash for storage
- **Referral codes:** 8-char alphanumeric, unique index
