require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { error } = require('./utils/response');

// ─── Env Validation ───
process.env.PORT = process.env.PORT || '3000';
const requiredEnvVars = ['PORT'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production' || process.env.JWT_SECRET.startsWith('enclave_jwt_secret_change_in_production')) {
  console.warn('[WARN] JWT_SECRET is not set — a random secret will be generated. Tokens will not persist across restarts.');
}

// ─── Rate Limiters ───
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,
  message: { success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX, 10) || 120,
  message: { success: false, message: 'Rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const scanLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: parseInt(process.env.SCAN_RATE_LIMIT_MAX, 10) || 30,
  message: { success: false, message: 'Too many scans. Please wait before scanning again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 2);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:4000', 'https://enclave-react.vercel.app'],
  credentials: true
}));
app.use(morgan('dev'));
app.use('/api', globalLimiter);

// Stripe webhook needs raw body — mount BEFORE express.json()
const stripeWebhookHandler = require('./routes/billing').webhookRaw;
if (stripeWebhookHandler) {
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Swagger API docs
const { swaggerUi, specs } = require('./config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Enclave API Documentation',
}));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authRoutes = require('./routes/auth');
const biometricsRoutes = require('./routes/biometrics');
const alertsRoutes = require('./routes/alerts');
const crawlerRoutes = require('./routes/crawler');
const monitoringRoutes = require('./routes/monitoring');
const legalRoutes = require('./routes/legal');
const userRoutes = require('./routes/user');
const detectRoutes = require('./routes/detect');
const notificationsRoutes = require('./routes/notifications');
const takedownsRoutes = require('./routes/takedowns');
const shieldsRoutes = require('./routes/shields');
const billingRoutes = require('./routes/billing');
const communityRoutes = require('./routes/community');
const revenueRoutes = require('./routes/revenue');
const reportsRoutes = require('./routes/reports');
const familyRoutes = require('./routes/family');
const referralsRoutes = require('./routes/referrals');
const feedbackRoutes = require('./routes/feedback');
const orgRoutes = require('./routes/organizations');
const adminRoutes = require('./routes/admin');
const insuranceRoutes = require('./routes/insurance');
const bountyRoutes = require('./routes/bounty');
const passportRoutes = require('./routes/passport');
const watermarkRoutes = require('./routes/watermark');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/biometrics', biometricsRoutes);
app.use('/api/alerts', scanLimiter, alertsRoutes);
app.use('/api/crawler', crawlerRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/user', userRoutes);
app.use('/api/detect', scanLimiter, detectRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/takedowns', takedownsRoutes);
app.use('/api/shields', shieldsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/community', scanLimiter, communityRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/bounty', bountyRoutes);
app.use('/api/passport', passportRoutes);
app.use('/api/watermark', watermarkRoutes);
app.use('/api/legal', legalRoutes);

app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };
  // DB health check
  try {
    const { getEngine } = require('./db/adapter');
    const db = await getEngine();
    health.db = { status: 'ok', engine: db.engine };
  } catch (e) {
    health.db = { status: 'error', message: e.message };
    health.status = 'degraded';
  }
  // ML service health
  try {
    const mlClient = require('./services/ml-client');
    const mlHealth = await mlClient.getHealth();
    health.ml = { status: mlHealth.status || 'unknown', models: mlHealth.models || null };
    if (mlHealth.status !== 'ok' && health.status === 'ok') health.status = 'degraded';
  } catch {
    health.ml = { status: 'unavailable' };
  }
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Serve frontend static files
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// ─── Structured Error Logger ───
const _errorCounts = { '4xx': 0, '5xx': 0, _windowStart: Date.now() };
const ERROR_WINDOW_MS = 5 * 60 * 1000; // 5-minute windows

app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      const bucket = res.statusCode < 500 ? '4xx' : '5xx';
      _errorCounts[bucket]++;
      const now = Date.now();
      if (now - _errorCounts._windowStart > ERROR_WINDOW_MS) {
        const counts = { '4xx': _errorCounts['4xx'], '5xx': _errorCounts['5xx'] };
        if (counts['4xx'] > 50 || counts['5xx'] > 10) {
          console.error(`[ALERT] Error spike in last ${ERROR_WINDOW_MS / 1000}s:`, counts);
        }
        _errorCounts['4xx'] = 0;
        _errorCounts['5xx'] = 0;
        _errorCounts._windowStart = now;
      }
      console.warn(`[API] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
    return originalJson(body);
  };
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  return error(res, err.message || 'Internal Server Error', 500);
});

async function start() {
  try {
    const { getEngine } = require('./db/adapter');
    const db = await getEngine();
    console.log(`[DB] Engine: ${db.engine}`);
  } catch (e) {
    console.warn('[DB] Init warning:', e.message);
  }
  try {
    const billing = require('./services/billing');
    billing.init();
  } catch (e) {
    console.warn('[BILLING] Init warning:', e.message);
  }
  // Takedown escalation matrix: verify removals / send reminders / escalate (every 15 min)
  try {
    const takedown = require('./services/takedown');
    const lifecycleTimer = setInterval(() => {
      takedown.processLifecycle().catch((e) =>
        console.warn('[TAKEDOWN] lifecycle tick failed:', e.message)
      );
    }, 15 * 60 * 1000);
    if (lifecycleTimer.unref) lifecycleTimer.unref();
  } catch (e) {
    console.warn('[TAKEDOWN] lifecycle init warning:', e.message);
  }

  // Weekly email digest — every Monday 09:00 UTC (Phase 2.2)
  try {
    const digest = require('./services/digest');
    const DIGEST_CHECK_INTERVAL = 10 * 60 * 1000; // check every 10 min
    const digestTimer = setInterval(() => {
      const now = new Date();
      // Monday = day 1
      if (now.getUTCDay() === 1 && now.getUTCHours() === 9 && now.getUTCMinutes() < 10) {
        console.log('[DIGEST] Sending weekly digests...');
        digest.sendDigestToAllUsers('weekly')
          .then((r) => console.log(`[DIGEST] Completed: ${r.sent} sent, ${r.failed} failed`))
          .catch((e) => console.warn('[DIGEST] batch send failed:', e.message));
      }
    }, DIGEST_CHECK_INTERVAL);
    if (digestTimer.unref) digestTimer.unref();
  } catch (e) {
    console.warn('[DIGEST] scheduler init warning:', e.message);
  }
  app.listen(PORT, () => {
    console.log(`Enclave API running on http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
