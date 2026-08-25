# Enclave Upgrade Plan — $0 Budget

## Infrastructure

### Primary: Oracle Cloud Always Free

| Resource | Spec | Cost |
|---|---|---|
| VM | 4 ARM vCPUs, 24 GB RAM (Ampere A1) | $0 forever |
| Storage | 200 GB block storage | $0 |
| Bandwidth | 10 TB/month outbound | $0 |
| Public IP | 1 reserved IPv4 | $0 |
| Object Storage | 20 GB | $0 |
| OS | Ubuntu 24.04 LTS | $0 |

**Fallback if ARM capacity unavailable:**
- Hetzner CAX11 (2 ARM, 4 GB) — $4.90/month
- Fly.io shared-cpu-1x (256 MB) — $2.02/month

### Deployment on Oracle VM (all Docker)

```
Oracle Cloud ARM VM (4 vCPU, 24 GB RAM)
├── Nginx (reverse proxy, TLS via Let's Encrypt)
├── Node.js API (Express)          ~200 MB RAM
├── PostgreSQL 16                   ~100 MB RAM
├── Python FastAPI ML Service       ~2-3 GB RAM (model loaded)
│   ├── ONNX Runtime (XceptionNet deepfake detection)
│   ├── Librosa (audio spectral analysis)
│   └── face_recognition / dlib (face matching)
├── Background Workers (cron)
│   ├── Social media scanner (every 6 hours)
│   ├── Reverse image search (Google/Yandex/TinEye)
│   ├── Takedown status tracker
│   └── Email notifications (Nodemailer + Gmail SMTP)
├── Umami (self-hosted analytics)
└── Total: ~4 GB used, ~20 GB free
```

---

## ML Inference Architecture (Zero Hardware)

### 3 Layers

| Layer | Runs On | Latency | Purpose |
|---|---|---|---|
| **Browser PWA** | User's device (WASM) | 30-80ms | Quick image scans |
| **Mobile** | User's device (Core ML / LiteRT) | 12-18ms | Quick image scans offline |
| **Server** | Oracle ARM VM (ONNX Runtime) | 15-30ms | Deep analysis, audio, batch |

### Layer 1: Server (Oracle ARM VM)

- **Runtime:** ONNX Runtime + FastAPI (Python)
- **Model:** XceptionNet (converted to .onnx, INT8 quantized, ~22 MB)
- **Audio:** Librosa + WavLM embeddings via HuggingFace
- **Face matching:** face_recognition (dlib, MIT license)
- **Performance:** ~15-30ms per image, ~100-500ms per audio clip
- **Audio fallback:** HuggingFace Serverless API (~$0.10/month free tier)

### Layer 2: Browser PWA

- **Runtime:** ONNX Runtime Web via Transformers.js (@huggingface/transformers)
- **Backend:** WASM (13x faster than WebGPU at batch size 1)
- **Model:** XceptionNet quantized INT8 (~22 MB), hosted on HuggingFace Hub
- **Offline:** Yes, model cached via Service Worker
- **Cold start:** ~500ms first load, then instant from cache

### Layer 3: Mobile On-Device

- **iOS:** Core ML (.mlpackage) — 12ms on Neural Engine (A12+)
- **Android:** LiteRT (.tflite, FP16) — 18ms on GPU delegate
- **Fallback:** INT8 quantized (~22 MB) — 10ms CPU
- **Model distribution:** Bundled inside app, zero network calls

### Model Conversion Pipeline (One-Time, Free)

```
PyTorch/XceptionNet
  → ONNX (torch.onnx.export)
    → Core ML (coremltools)
    → LiteRT (tf.lite.TFLiteConverter)
    → Browser ONNX (quantize to INT8)
```

All conversion tools are free Python packages.

---

## Free Services Map

| Need | Service | Free Limit |
|---|---|---|
| Compute | Oracle Cloud ARM | 4 vCPU / 24 GB, forever |
| Database | PostgreSQL (on Oracle VM) | Free |
| Object Storage | Oracle Cloud | 20 GB |
| ML Inference (image) | ONNX Runtime (on Oracle VM) | Free |
| ML Inference (browser) | ONNX Runtime Web (user device) | Free |
| ML Inference (mobile) | Core ML / LiteRT (user device) | Free |
| ML Inference (audio fallback) | HuggingFace Serverless | ~$0.10/month |
| Face Recognition | face_recognition / dlib | MIT license |
| Audio Analysis | Librosa | BSD license |
| Model Hosting | HuggingFace Hub | Free (public repos) |
| TLS/SSL | Let's Encrypt | Free |
| Email | Nodemailer + Gmail SMTP | Free (500/day) |
| Push Notifications | Firebase Cloud Messaging | Free (unlimited) |
| Static Hosting | Cloudflare Pages | Free |
| Analytics | Umami (self-hosted on Oracle VM) | Free |
| Rate Limiting | express-rate-limit | MIT license |
| PDF Generation | PDFKit (Node.js) | MIT license |
| Web Scraping | Playwright (on Oracle VM) | Apache 2.0 |
| Browser Extension | Manifest V3 | Free |

**Total monthly cost: $0.00**

---

## Execution Phases

### Phase 0: Fix Foundations (Week 1-2)

**Goal:** Remove fake data, add security, make detection real.

| Task | File | Action |
|---|---|---|
| Remove random score generation | `backend/src/routes/alerts.js` | Delete random confidence (65-90%), replace with real detection call |
| Remove fake crawler alerts | `frontend/app.js` | Delete Web Worker that generates hardcoded alerts |
| Add rate limiting | `backend/package.json` | Install `express-rate-limit`, add to auth routes |
| Fix JWT secret | `backend/src/middleware/auth.js` | Generate random secret on first run, store in .env |
| Add .env validation | `backend/src/index.js` | Crash on startup if JWT_SECRET is dev default |
| Fix Google Sign-In | `frontend/auth-ui.js` | Replace placeholder client ID with Firebase Auth |
| Fix forgot password | `frontend/auth-ui.js` | Replace client-side code with Nodemailer email or EmailJS free tier |
| Add PDF generation | `backend/` | Install PDFKit, replace .txt document output with proper PDFs |
| Add tests | project root | Jest + Playwright, test all endpoints |
| Docker Compose update | `docker-compose.yml` | Add Python ML service, Nginx, Umami |

### Phase 1: Real Detection Engine (Week 2-4)

**Goal:** Replace random scores and MobileNet with real deepfake detection.

| Task | Detail |
|---|---|
| Set up Oracle Cloud ARM VM | Create Always Free A1 instance, install Ubuntu 24.04, Docker |
| Deploy PostgreSQL | Docker container on Oracle VM |
| Deploy Node.js API | Docker container on Oracle VM |
| Create Python ML microservice | FastAPI + ONNX Runtime + Librosa + face_recognition |
| Download XceptionNet .onnx | From HuggingFace: `Redgerd/XceptionNet-Keras`, convert to ONNX |
| Quantize model to INT8 | Use ONNX Runtime quantization tools |
| Wire detection pipeline | Node.js calls Python service at port 4001 for all detection |
| Face extraction | Add MTCNN or RetinaFace for face cropping before XceptionNet |
| Audio detection | Add Librosa spectral analysis + WavLM speaker verification |
| Deploy Nginx | Reverse proxy with Let's Encrypt TLS on Oracle VM |
| Update backend routes | `alerts.js`, `detect.js` — all paths call real detection |

**Detection pipeline:**
```
Image/URL → Face extraction (MTCNN) → Crop face → Resize 299x299
  → XceptionNet ONNX inference → confidence score → verdict
  → LIKELY_SYNTHETIC (>0.6) / SUSPICIOUS (>0.35) / LIKELY_NATURAL
```

### Phase 2: Proactive Monitoring (Week 4-6)

**Goal:** Actively scan the web for user identity misuse.

| Task | Detail |
|---|---|
| Social media scanner | Background worker on Oracle VM, runs every 6 hours |
| Reverse image search | Google Images, Yandex, TinEye (web scraping via Playwright) |
| Face matching | Compare found images with enrolled face using face_recognition |
| Alert creation | Real alerts with source URL, confidence, timestamp |
| Web push notifications | Firebase Cloud Messaging (free, unlimited) |
| Email alerts | Nodemailer + Gmail SMTP on notification events |
| Dark web monitoring | Ahmia API (free Tor search) for username/email leaks |

### Phase 3: Automated Takedown Pipeline (Week 6-8)

**Goal:** Auto-generate and send legal takedown notices.

| Task | Detail |
|---|---|
| PDF legal documents | DMCA 512(c), Cease & Desist, TAKE IT DOWN Act complaint |
| Legal templates | US federal + 46 state NCII-specific templates |
| Auto-email to platforms | Send to abuse@ inboxes via Nodemailer |
| Takedown tracking | Poll platform APIs, track sent/acknowledged/removed |
| Follow-up escalation | Re-send after 48 hours (TAKE IT DOWN Act requirement) |
| StopNCII.org integration | Generate perceptual hashes for cross-platform blocking |
| User dashboard | Real-time takedown status in alert detail view |
| Evidence preservation | Screenshot + metadata + timestamps before removal |

### Phase 4: Browser Extension (Week 8-10)

**Goal:** Scan content inline while users browse.

| Task | Detail |
|---|---|
| Manifest V3 extension | Chrome + Firefox + Edge |
| Right-click scan | "Scan for Deepfake" on any image |
| Inline badges | Confidence badge on hover over faces in social media feeds |
| Auto-scan (opt-in) | Throttled scanning of images in feed |
| One-click report | Send detected deepfake to takedown pipeline |
| Backend integration | Extension calls `/api/detect/image` on Oracle VM |
| Model caching | Cache ONNX model in extension storage |

### Phase 5: On-Device ML (Week 10-12)

**Goal:** Run detection on the user's phone, offline, private.

| Task | Detail |
|---|---|
| Convert XceptionNet → Core ML | Use `coremltools`, produce .mlpackage |
| Convert XceptionNet → LiteRT | Use TFLite converter, produce .tflite (FP16 + INT8) |
| Bundle in iOS app | Xcode integration, Core ML API calls |
| Bundle in Android app | Capacitor plugin or native module, LiteRT interpreter |
| Device capability detection | iOS 15+ → Core ML, Android with NNAPI → LiteRT, else server fallback |
| Benchmark on target devices | Test latency, memory, battery on real phones |

### Phase 6: Real Shields (Week 12-14)

**Goal:** Replace cosmetic overlays with actual protection.

| Task | Detail |
|---|---|
| Camera Immunizer upgrade | Replace noise injection with C2PA content credentials embedding |
| Content Authenticity | Use `content-credentials` npm package (free, open standard) |
| Invisible watermarking | Embed steganographic watermark via `invisible-watermark` Python lib |
| Voice Shield upgrade | Real-time voice authentication (compare against enrolled voiceprint) |
| Shield overlay upgrade | Show real status: monitoring active, last scan, threats blocked |
| Shield statistics | Images scanned, deepfakes found, takedowns sent |

### Phase 7: Payment Integration (Week 14-16)

**Goal:** Monetize with freemium subscriptions.

| Task | Detail |
|---|---|
| Stripe integration | Subscription management, free to set up (2.9% per txn) |
| Tier enforcement | Free: 5 scans/month, Pro: unlimited, Shield: + takedowns |
| Usage tracking | Track scans, detections, takedowns per user |
| LemonSqueezy alternative | Handles taxes/invoicing (5% + $0.50) |

**Pricing tiers:**

| Tier | Price | Features |
|---|---|---|
| Free | $0 | 5 scans/month, basic image detection |
| Pro | $9.99/mo | Unlimited scans, audio + video, monitoring, legal docs |
| Shield | $19.99/mo | + automated takedowns, family (3 profiles), priority |
| Business | $49.99/mo | + API access, team management, compliance reports |

### Phase 8: Marketing & Distribution (Week 16+)

| Channel | Action | Cost |
|---|---|---|
| App Store | Submit iOS app | $99/year (already have) |
| Google Play | Submit Android app | $25 one-time (already have) |
| PWA direct install | No store needed | $0 |
| Product Hunt | Launch day | $0 |
| Hacker News | "Show HN" post | $0 |
| Reddit | r/privacy, r/cybersecurity, r/deepfakes | $0 |
| Twitter/X | Thread about deepfake problem + solution | $0 |
| YouTube | Demo video of detection in action | $0 |
| Dev.to / Medium | Technical blog posts | $0 |
| GitHub | Open-source detection engine (MIT license) | $0 |
| SEO | Blog about deepfake news, legal cases | $0 |
| Press | Email journalists covering AI safety | $0 |

---

## Complete Architecture (Post-Upgrade)

```
┌──────────────────────────────────────────────────────────┐
│                    USER'S DEVICE                          │
│                                                           │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ Browser PWA      │  │ Mobile App (iOS/Android)     │  │
│  │ ONNX Runtime Web │  │ Core ML (iOS) / LiteRT (And) │  │
│  │ WASM backend     │  │ On-device inference          │  │
│  │ ~30-80ms         │  │ ~12-18ms                     │  │
│  └────────┬────────┘  └──────────────┬───────────────┘  │
│           │                          │                    │
│  ┌────────┴──────────────────────────┴───────────────┐  │
│  │           Browser Extension (Manifest V3)          │  │
│  │           Inline deepfake detection while browsing │  │
│  └────────────────────────┬──────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │ HTTPS
                            ▼
┌──────────────────────────────────────────────────────────┐
│           ORACLE CLOUD — ALWAYS FREE ARM VM               │
│           4 vCPU / 24 GB RAM / $0 forever                 │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Nginx       │→│ Node.js API  │→│ Python FastAPI  │  │
│  │ Let's       │  │ Express      │  │ ML Service      │  │
│  │ Encrypt TLS │  │ Auth/JWT     │  │ ONNX Runtime    │  │
│  │             │  │ Rate limit   │  │ XceptionNet     │  │
│  │             │  │ Alerts CRUD  │  │ Librosa         │  │
│  │             │  │ Takedowns    │  │ face_recognition │  │
│  │             │  │ Crawler      │  │                │  │
│  └─────────────┘  └──────┬───────┘  └────────────────┘  │
│                          │                                │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │ PostgreSQL 16 (Docker)                             │  │
│  │ users, faceprints, voiceprints, signatures,       │  │
│  │ alerts, documents, auth_attempts, scan_sessions    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Background Workers (cron on ARM VM)               │   │
│  │ • Social media scanner (every 6 hours)            │   │
│  │ • Reverse image search (Google/Yandex/TinEye)     │   │
│  │ • Takedown status tracker                         │   │
│  │ • Email notifications (Nodemailer + Gmail)        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Umami Analytics (self-hosted)                     │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                            │
                            │ Fallback for heavy audio analysis
                            ▼
┌──────────────────────────────────────────────────────────┐
│           HUGGINGFACE SERVERLESS API (free tier)          │
│           ~$0.10/month                                   │
│                                                           │
│  • WavLM speaker embeddings                              │
│  • Audio classification (deepfake voice detection)        │
│  • Whisper transcription                                  │
└──────────────────────────────────────────────────────────┘
```

---

## Free Open-Source Models & Tools

| Component | Tool | License |
|---|---|---|
| Image deepfake detection | XceptionNet (HuggingFace) | MIT |
| Video deepfake detection | XceptionNet + LSTM (HuggingFace) | MIT |
| Face extraction | MTCNN / RetinaFace | MIT |
| Face recognition | face_recognition (dlib) | MIT |
| Audio deepfake detection | Librosa + WavLM | BSD / MIT |
| Speaker verification | WavLM (HuggingFace) | MIT |
| PDF generation | PDFKit (Node.js) | MIT |
| HTML-to-PDF | Puppeteer | BSD |
| Browser runtime | ONNX Runtime Web (WASM) | MIT |
| Mobile runtime (iOS) | Core ML | Free with iOS |
| Mobile runtime (Android) | LiteRT (TFLite) | Apache 2.0 |
| Browser ML pipeline | Transformers.js | Apache 2.0 |
| Watermarking | invisible-watermark | MIT |
| Content credentials | C2PA SDK | Apache 2.0 |
| Web scraping | Playwright | Apache 2.0 |
| Rate limiting | express-rate-limit | MIT |
| Email sending | Nodemailer | MIT |
| Push notifications | Firebase Cloud Messaging | Free |
| Analytics | Umami (self-hosted) | MIT |
| TLS certificates | Let's Encrypt | Free |

---

## Timeline

| Week | Phase | Deliverable |
|---|---|---|
| 1-2 | Phase 0 | Security fixes, remove fake data, rate limiting, tests |
| 2-4 | Phase 1 | Oracle VM setup, real detection engine (XceptionNet + Librosa) |
| 4-6 | Phase 2 | Proactive monitoring (social media + reverse image search) |
| 6-8 | Phase 3 | Automated takedown pipeline + legal PDFs |
| 8-10 | Phase 4 | Browser extension (Manifest V3) |
| 10-12 | Phase 5 | On-device ML (Core ML + LiteRT) |
| 12-14 | Phase 6 | Real shields (C2PA, watermarking, voice auth) |
| 14-16 | Phase 7 | Stripe payment integration + subscription tiers |
| 16+ | Phase 8 | Marketing + distribution |

**Total cost: $0/month**
