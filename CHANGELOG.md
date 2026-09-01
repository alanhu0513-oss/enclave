# Changelog

## [Unreleased]

### Added
- Phase 13: CI/CD pipeline (GitHub Actions)
- Phase 12: API platform improvements (rate limits, webhook test, permissions)
- Phase 11: Offline detection UI, PWA manifest, service worker
- Phase 10: Public blog API, RSS feed, newsletter signup
- Phase 9: Vendor code splitting, service worker caching
- Phase 8: Blog detail view, newsletter subscription
- Phase 7: Real voice analysis (FFT-based), model swap, A/B routing
- Phase 6: Enterprise features (SSO, organizations, white-label)
- Phase 5: Video Call Shield advanced (multi-participant, audio)
- Phase 4: Browser extensions (Deepfake Radar, Video Call Shield)
- Phase 3: Real-time infrastructure (WebSocket, job queue, event bus)
- Phase 2: Security hardening (crypto.randomInt, command injection fix)
- Phase 1: Data foundation (DB migration, all routes async)

### Changed
- Blog API now public (no auth required for SEO crawlers)
- Rate limit dashboard shows real usage data
- Webhook test endpoint dispatches actual HTTP requests
- API key permissions now enforced

### Fixed
- Password reset code using `Math.random()` → `crypto.randomInt()`
- Command injection in `detect.js` via `execSync()` → `execFileSync()`
- CSP headers: removed `unsafe-eval`
- Blog frontend now fetches from API (replaces hardcoded data)

## [1.0.0] - 2025-09-01

### Initial Release
- Deepfake detection pipeline (Cloud AI → Gemini → XceptionNet → Local)
- Identity monitoring with proactive web crawler
- Takedown pipeline with PDF generation
- Real-time alerts via WebSocket + email
- Browser extensions for image and video call protection
- API platform with keys, rate limiting, webhooks
- Education center with tutorials and certifications
- Enterprise features (SSO, organizations, audit logs)
- Family plans for shared monitoring
