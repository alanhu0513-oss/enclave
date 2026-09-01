# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Enclave, please report it responsibly:

1. **Email**: security@enclave.app (or open a private GitHub issue)
2. **Include**: Description, steps to reproduce, potential impact
3. **Response**: We aim to acknowledge within 24 hours and provide a fix timeline within 72 hours

## Security Measures

### Authentication
- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens with short expiry
- Password reset codes: 8-digit `crypto.randomInt()` (not `Math.random()`)
- API keys: 32-byte hex tokens with prefix `env_`

### API Security
- Rate limiting: global (120/min), auth (20/15min), API (100/min per key)
- API key permissions enforced (read-only, read-write, admin)
- CORS configured for production origins only
- CSP headers with `unsafe-inline` only (no `unsafe-eval`)

### Data Protection
- PostgreSQL with encrypted connections
- No secrets in code (all via environment variables)
- Webhook payloads signed with HMAC-SHA256
- API usage logged with IP addresses

### Infrastructure
- HTTPS enforced everywhere
- Security headers via Helmet.js
- Input validation at API boundaries
- SQL injection prevention via parameterized queries

## Scope

- Backend API (`api.enclave.app`)
- Frontend (`enclave-react.vercel.app`)
- Chrome Extensions (Deepfake Radar, Video Call Shield)
- Python ML Service

## Out of Scope

- Third-party services (Stripe, Vercel, Railway)
- Social engineering attacks
- Physical security
