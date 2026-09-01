# Monitoring Setup Guide

## 1. UptimeRobot (Free — 50 Monitors)

### Setup
1. Sign up at https://uptimerobot.com (free tier)
2. Add these monitors:

| Monitor | URL | Interval | Type |
|---------|-----|----------|------|
| Backend API | `https://enclave-production-d818.up.railway.app/api/health` | 5 min | HTTP(S) |
| Frontend | `https://enclave-react.vercel.app` | 5 min | HTTP(S) |
| ML Service | `https://enclave-production-d818.up.railway.app/api/health` | 5 min | HTTP(S) |

### Alert Contacts
- Email: your-email@example.com
- SMS (optional): For critical alerts

### Expected Response
```json
{
  "status": "ok",
  "db": { "status": "ok" },
  "ml": { "status": "ok" },
  "redis": { "status": "ok" }
}
```

## 2. Sentry Error Tracking (Already Configured)

### Backend
- DSN: Set `SENTRY_DSN` env var in Railway
- Features: Error capture, breadcrumbs, performance tracing
- Release tracking via `npm_package_version`

### Frontend
- `@sentry/react` initialized in `src/lib/sentry.ts`
- Error boundary wraps entire app
- Performance monitoring with `tracesSampleRate: 0.1`

### Verify Sentry
```bash
# Check if Sentry is initialized
curl -s https://enclave-production-d818.up.railway.app/api/health | jq .status
```

## 3. BetterStack (Optional — Free Tier)

### Setup
1. Sign up at https://betterstack.com
2. Connect GitHub repo for deployment tracking
3. Add uptime monitors for all endpoints

### Features
- Uptime monitoring (30-second intervals on paid plans)
- Incident management
- Status pages
- Log management

## 4. Railway Metrics

### Built-in Monitoring
Railway provides:
- CPU usage
- Memory usage
- Network I/O
- Deploy history
- Logs

### Access
- Dashboard: https://railway.com/dashboard
- Select project → Metrics tab

## 5. Vercel Analytics

### Enable
1. Go to Vercel dashboard → Project → Analytics
2. Enable Web Vitals tracking

### Metrics Tracked
- FCP (First Contentful Paint)
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)
- INP (Interaction to Next Paint)

## 6. Custom Metrics Endpoint

### GET /api/metrics
Returns:
```json
{
  "requests": {
    "total": 12345,
    "perMinute": 42,
    "errorRate": 0.02
  },
  "alerts": {
    "total": 156,
    "takedowns": 23
  },
  "users": {
    "active": 89,
    "total": 1234
  }
}
```

## 7. Alert Thresholds

### Critical (Immediate)
- API health check fails for 3 consecutive checks
- Error rate > 5% for 5 minutes
- Memory usage > 90%
- DB connection failures

### Warning (Within 1 hour)
- Response time > 2 seconds (p99)
- Error rate > 2% for 10 minutes
- Memory usage > 75%
- Disk usage > 80%

## 8. Dashboard URLs

| Service | URL |
|---------|-----|
| UptimeRobot | https://uptimerobot.com/dashboard |
| Sentry | https://sentry.io |
| Railway | https://railway.com/dashboard |
| Vercel | https://vercel.com/dashboard |
