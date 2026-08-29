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
    : ['http://localhost:3000', 'http://localhost:4000', 'https://frontend-one-gamma-83.vercel.app'],
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

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/biometrics', biometricsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/crawler', crawlerRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/user', userRoutes);
app.use('/api/detect', detectRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/takedowns', takedownsRoutes);
app.use('/api/shields', shieldsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/legal', legalRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
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
