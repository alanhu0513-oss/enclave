# Enclave — Master Roadmap (Options A + B + C)

> **Status snapshot (what's already shipped):** Live React frontend (`enclave-react.vercel.app`) + Railway
> backend. Real Stripe billing (checkout + webhook + portal, live-enforced). Usage metering per tier.
> Full growth UI built: Reports, Community, Family, Referrals, alerts lifecycle. All committed/pushed.
> Constraint: **$0 budget** (strict, permanent). Backend uses a JSON volume fallback; PostgreSQL via Docker Compose.

This master plan unifies the three candidate "next large plans" into one sequenced roadmap. The three
thrusts are not mutually exclusive — they are ordered so each de-risks the next:

- **Phase A — Launch & revenue validation** (prove people will pay, fix the revenue-critical QA gaps)
- **Phase B — Production hardening & trust** (make it survive real users; security + reliability at scale)
- **Phase C — Depth expansion** (fill the remaining product surface for retention & upgrades)

---

## Phase A — Go-To-Market & Revenue Validation
**Goal:** Turn the finished product into a business. Validate willingness-to-pay, fix revenue-blocking
bugs, and instrument the funnel.

### A.1 Billing Smoke Test (revenue-critical QA)
- End-to-end happy path: register → choose plan → Stripe Checkout → webhook activates tier → limit
  unlocks (scan goes from 429 → 200). Verify portal cancel → tier downgrade.
- Verify the three 404s found earlier were only wrong guessed paths (correct ones confirmed).
- Sign in with the existing `pgtest@test.com` test user against the live Railway backend.
- Files: `backend/src/routes/billing.js`, `backend/src/services/billing.js`

### A.2 Onboarding Funnel Conversion
- 3-step guided setup (already specced in `plan.md` 1.1): face enrollment → first scan result → tab tour.
- Route new + free users toward `detection_only`/`pro` upgrade with contextual prompts, not nag-screens.
- Add a "why protect your identity" education layer on the free plan to drive perceived value.
- Files: `frontend-react/src/features/home/home-view.tsx`, new `features/onboarding/`

### A.3 Referral / Waitlist Launch Surface
- Prominent "invite friends" affordance (referral panel exists; surface it as a growth loop).
- Landing/launch page that captures emails/waitlist and routes to Signup → first scan.
- Track referral attribution landing (the `/refer?code=` route already points here — make it a real page).
- Files: `frontend-react/src/features/settings/referral-panel.tsx`, new `features/marketing/`

### A.4 Analytics & Funnel Instrumentation
- Enable the Umami analytics already in `docker-compose.yml`.
- Track: signup → first scan → plan view → checkout → activation. Also conversion by plan.
- Files: `docker-compose.yml`, root `frontend-react/src/lib/api.ts` (event hooks)

### A.5 Pricing & Messaging Test
- Reuse `getTiers()` pricing for A/B of plan names/prices; add per-tier explainer in Settings.
- Copy review pass for clarity + compliance (no overclaiming trademark/protection guarantees).

---

## Phase B — Production Hardening & Trust
**Goal:** Make the platform reliable and trustworthy enough for real users + enterprise scrutiny.

### B.1 ML Pipeline Resilience
- Add circuit-breaker + retry/backoff to `ml-client.js` when the Python service is unreachable.
- Warm the ONNX models; add graceful "model loading" state to the scan UI instead of silent failure.
- Load-test image detection; cap memory/time on large uploads (10MB limit exists — validate).
- Files: `backend/src/services/ml-client.js`, `backend/src/routes/alerts.js`, `backend/src/routes/detect.js`

### B.2 Security & Auth Hardening
- Security pass on: auth (bcrypt/JWT/token revocation `tv` claim), Stripe webhook signature path,
  per-user data access (IDs are UUID but confirm ownership checks end-to-end), input validation.
- Rate-limit all endpoints (global + auth limits already exist — extend to detect/report/community).
- `.env` hygiene: confirm no secrets committed; scan repo for keys (the Mistral + Stripe secret).
- Files: `backend/src/middleware/auth.js`, `backend/src/index.js`, `backend/src/routes/*`

### B.3 Reliability & Monitoring
- Health/liveness + uptime checks for backend + ML service.
- Structured error capture; alert on 4xx/5xx spikes (email via existing Nodemailer).
- Backup/restore story for the JSON volume on Railway.
- Files: `backend/src/index.js`, `backend/src/services/notifications.js`

### B.4 Takedown Pipeline Depth
- Wire the 48h follow-up escalation + evidence timeline into the takedown UI (backend logic exists).
- Files: `backend/src/routes/takedowns.js`, `frontend-react/src/features/alerts/alerts-view.tsx`

---

## Phase C — Depth Expansion (Retention & Upsell)
**Goal:** Expand the product surface to deepen retention and fuel upgrades.

### C.1 Notifications Everywhere (FCM + email)
- Wire real FCM push (token registration exists) + digest email to alert lifecycle events.
- Files: `backend/src/routes/notifications.js`, `backend/src/services/notifications.js`

### C.2 Real-Time Deep Monitoring UI
- Surface crawler/monitoring status + recent pro-active detections in a "Live Monitoring" view.
- Files: `backend/src/services/monitoring-service.js`, `backend/src/services/crawler.js`, new `features/monitoring/`

### C.3 Native Mobile Shell (Capacitor)
- Wire the existing Capacitor native shell (iOS Live Activity / Android overlay) to the React app.
- Files: `frontend/` (Capacitor), `frontend/ios/`, `frontend/android/`

### C.4 Deep Scan & Watermark UX
- Polish deep-scan wizard (reverse search + watermark view already partially built) into a guided flow.
- Files: `frontend-react/src/features/scan/scan-view.tsx`

---

## Suggested Execution Order & Signposts
1. **A.1 first** — revenue-critical gate. Nothing else matters if checkout is broken.
2. **A.2 + A.4** in parallel (onboarding + analytics) → observable funnel.
3. **Harden (B.1–B.3)** before inviting real traffic from A.3 marketing.
4. **C-phase** only after A + B are stable — depth without revenue/trust is wasted effort.

**Entry criteria for Phase B:** A.1 passes end-to-end and A.2 funnel metrics are being captured.
**Entry criteria for Phase C:** A + B stable with real (even small) traffic and no revenue blockers.

---

## Definitions of Done (whole roadmap)
- Every revenue action (checkout/cancel/upgrade) verified live end-to-end.
- Funnel metrics track signup → activation → paid.
- ML + auth + billing hardened against real users and a basic security pass is documented.
- No secrets in the repo; rate limits on all resource-consuming routes.
- New depth features ship behind a working monitoring + notification loop.
