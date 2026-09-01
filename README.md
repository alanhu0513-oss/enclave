# Enclave

AI-powered deepfake detection, identity monitoring, and takedown services.

## Features

- **Deepfake Detection** — Multi-layered ML pipeline (Cloud AI → Gemini → XceptionNet ONNX → Local Heuristic)
- **Identity Monitoring** — Proactive web crawler searches search engines + dark web for your face/voice
- **Takedown Pipeline** — Auto-generate DMCA/C&D PDFs, email platform abuse teams, track lifecycle
- **Real-Time Alerts** — WebSocket push notifications + email + browser push
- **Browser Extensions** — Deepfake Radar (image analysis) + Video Call Shield (real-time call protection)
- **API Platform** — RESTful API with API keys, rate limiting, webhooks, usage analytics
- **Education Center** — Tutorials, certifications, blog with threat intelligence
- **Enterprise** — SSO, organizations, audit logs, white-label branding
- **Family Plans** — Shared monitoring across family members

## Quick Start

```bash
# Backend
cd backend && npm install && npm start

# Frontend
cd frontend-react && npm install && npm run dev

# ML Service
cd ml-service && pip install -r requirements.txt && python app.py
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  React + Vite + TailwindCSS + Framer Motion      │
│  PWA with Service Worker + Offline Support       │
└─────────────────┬───────────────────────────────┘
                  │ REST API
┌─────────────────▼───────────────────────────────┐
│                Backend (Node.js)                 │
│  Express + PostgreSQL + Redis (BullMQ)           │
│  JWT Auth + API Key Auth + Rate Limiting          │
│  WebSocket (Socket.IO) + Event Bus               │
└────┬────────────┬───────────────┬───────────────┘
     │            │               │
     ▼            ▼               ▼
┌─────────┐ ┌──────────┐ ┌──────────────┐
│ Cloud AI │ │ Gemini   │ │ Python ML    │
│ (Groq/   │ │ Flash    │ │ XceptionNet  │
│ Cerebras)│ │          │ │ ONNX + MTCNN │
└─────────┘ └──────────┘ └──────────────┘
```

## API Documentation

- Swagger UI: `https://api.enclave.app/api-docs`
- RSS Feed: `https://api.enclave.app/api/education/rss`

## Deployment

- **Backend**: Railway (`railway up --yes`)
- **Frontend**: Vercel (`npx vercel --prod --yes`)
- **ML Service**: Docker or standalone Python

## Testing

```bash
cd backend && npm test  # 99 tests, 8 suites
```

## License

Proprietary. All rights reserved.
