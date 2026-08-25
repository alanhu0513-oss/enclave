# Enclave — Build & Verify Commands

## Backend
```bash
# Start server (port 4000, PostgreSQL required)
cd /Users/hu/Documents/enclave/backend && node src/index.js

# Syntax check
node -c src/index.js && node -c src/routes/*.js && node -c src/db/adapter.js

# Run tests (uses JSON file fallback, no PostgreSQL needed)
cd /Users/hu/Documents/enclave/backend && npm test

# Quick smoke test
curl -s http://localhost:4000/api/health

# Register
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","fullName":"Test User"}'

# Login (test user: pgtest@test.com / Test1234!)
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pgtest@test.com","password":"Test1234!"}' | \
  node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('FAIL')}})")

# URL scan (real ML detection)
curl -s -X POST http://localhost:4000/api/alerts/scan/url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://example.com"}'

# Image scan (real ML detection)
curl -s -X POST http://localhost:4000/api/alerts/scan/image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@test-image.jpg"

# Deep scan (live search engine crawl)
curl -s -X POST http://localhost:4000/api/alerts/deep-scan \
  -H "Authorization: Bearer $TOKEN"

# Forgot password
curl -s -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Generate PDF document
curl -s -X POST http://localhost:4000/api/alerts/<alert-id>/document \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"dmca"}'
```

## Frontend
```bash
# Syntax check all JS (run from /Users/hu/Documents/enclave/frontend)
node -c native-bridge.js && node -c api.js && node -c auth-ui.js && node -c app.js

# Sync to native
cp native-bridge.js www/native-bridge.js && npx cap sync
```

## Docker Compose
```bash
# Full stack (PostgreSQL + API + ML + Nginx + Umami)
cd /Users/hu/Documents/enclave && docker compose up -d

# ML service only
cd /Users/hu/Documents/enclave && docker compose up ml-service

# Health checks
curl -s http://localhost:4000/api/health
curl -s http://localhost:8001/health
curl -s http://localhost:3001
```

## iOS
```bash
# Open in Xcode
open /Users/hu/Documents/enclave/frontend/ios/App/App.xcworkspace

# Build extension + app (requires Apple Developer team)
# 1. Select ShieldOverlayExtension target → Signing & Capabilities → set team
# 2. Select App target → Signing & Capabilities → set team
# 3. Build → Product > Build (Cmd+B)
```

## Android
```bash
# Open in Android Studio
open /Users/hu/Documents/enclave/frontend/android

# Build
cd /Users/hu/Documents/enclave/frontend/android && ./gradlew assembleDebug
```

## Key Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/auth/register` | POST | `{email, password, fullName}` |
| `/api/auth/login` | POST | `{email, password}` → `data.token` |
| `/api/auth/forgot-password` | POST | `{email}` — sends reset code |
| `/api/auth/reset-password` | POST | `{email, code, newPassword}` |
| `/api/auth/google` | POST | `{credential}` — Google OAuth (stub) |
| `/api/alerts` | GET | List alerts (auth) |
| `/api/alerts/scan/url` | POST | URL scan via Python ML service (auth) |
| `/api/alerts/scan/image` | POST | Image scan via Python ML service (auth, multipart) |
| `/api/alerts/deep-scan` | POST | Live search engine crawl (auth) |
| `/api/alerts/:id/whitelist` | PATCH | Mark alert as safe (auth) |
| `/api/alerts/:id/document` | POST | Generate DMCA/C&D PDF (auth) |
| `/api/detect/image` | POST | Direct image deepfake detection (auth, multipart) |
| `/api/detect/url` | POST | Direct URL image detection (auth) |
| `/api/detect/face/match` | POST | Compare two faces for identity match (auth, multipart: image_a, image_b) |
| `/api/user/data` | GET | User profile + alerts (auth) |
| `/api/biometrics/status` | GET | Biometric verification status (auth) |
| `/api/biometrics/face` | POST | Upload face scan (auth, multipart) |
| `/api/notifications` | GET | List notifications (auth, ?unread=true, ?limit=20) |
| `/api/notifications/unread-count` | GET | Count unread notifications (auth) |
| `/api/notifications/:id/read` | PATCH | Mark notification as read (auth) |
| `/api/notifications/read-all` | POST | Mark all notifications as read (auth) |
| `/api/notifications/fcm-token` | POST | Register FCM push token (auth) |
| `/api/notifications/preferences` | PATCH | Update notification prefs (auth, {emailNotifications}) |
| `/api/takedowns` | GET | List user's takedowns (auth) |
| `/api/takedowns/:id` | GET | Get takedown detail (auth) |
| `/api/takedowns/:alertId/initiate` | POST | Start takedown for alert (auth, {type, sendEmail}) |
| `/api/takedowns/:id/status` | PATCH | Update status (auth, {status, notes}) |
| `/api/takedowns/:id/pdf` | GET | Download takedown PDF (auth) |
| `/api/takedowns/:id/evidence` | GET | View preserved evidence (auth) |
| `/api/takedowns/check-follow-ups` | POST | Check 48h escalations (auth) |
| `/api/takedowns/stats/summary` | GET | Takedown statistics (auth) |

## ML Endpoints (Python service, port 8001)
| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Service health + loaded models |
| `/detect/image` | POST | Image deepfake detection (MTCNN + XceptionNet) |
| `/detect/audio` | POST | Audio deepfake detection (Librosa spectral analysis) |
| `/face/match` | POST | Compare two faces (face_recognition embeddings) |
| `/face/embedding` | POST | Compute face embedding for enrollment |
| `/models/download` | POST | Trigger ONNX model download |

## Architecture Notes
- Backend: Express + bcrypt + JWT, PostgreSQL (primary), JSON file fallback
- ML Pipeline: Python FastAPI service with MTCNN face extraction → XceptionNet ONNX (299x299) → heuristic scoring. Audio: Librosa spectral analysis. Face matching: face_recognition (dlib).
- Node.js `ml-client.js` calls Python ML service; falls back to local heuristic analysis if unreachable
- Proactive Monitoring: Crawler searches DuckDuckGo + Yandex + Ahmia (dark web). Downloads and analyzes images from results. Face matching against enrolled faceprints. Email alerts via Nodemailer. Push via FCM.
- Takedown Pipeline: Auto-generate DMCA / Cease & Desist / TAKE IT DOWN Act PDFs. Auto-email to platform abuse@ inboxes. Lifecycle tracking (sent → acknowledged → removed / escalated). 48-hour follow-up escalation. Evidence preservation (HTML snapshots + metadata).
- Notifications: In-app (notifications table), email (Nodemailer + Gmail SMTP), push (Firebase Cloud Messaging)
- Frontend: PWA at `/Users/hu/Documents/enclave/frontend/`, Capacitor v8 wraps native
- Nginx: Reverse proxy with rate limiting, security headers, gzip
- Docker Compose: PostgreSQL + API + ML Service (with model-init) + Nginx + Umami analytics
- iOS: Live Activity / Dynamic Island via `ShieldOverlayExtension`
- Android: Floating bubble overlay via `ShieldForegroundService` + `ShieldOverlayPlugin`
- Camera Immunizer: noise matrix injection on JPEG (native file watcher)
- Voice Shield: background audio scrambling (Capacitor Audio plugin)
- App Group: `group.app.enclave.vault` for UserDefaults sharing (iOS)
- Extension bundle ID: `app.enclave.vault.ShieldOverlayExtension`
