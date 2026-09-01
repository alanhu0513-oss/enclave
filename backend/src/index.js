require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { error } = require('./utils/response');
const { securityHeaders, sanitizeInput } = require('./middleware/security');
const { UPLOAD_DIR } = require('./utils/upload-dir');

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
app.use(securityHeaders);
app.use(sanitizeInput);
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://enclave-react.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:4000",
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
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
app.use('/uploads', express.static(UPLOAD_DIR));

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
const voiceCloneRoutes = require('./routes/voice-clone');
const estateRoutes = require('./routes/estate');
const ssoRoutes = require('./routes/sso');
const apiPlatformRoutes = require('./routes/api-platform');
const mlRoutes = require('./routes/ml');
const whitelabelRoutes = require('./routes/whitelabel');
const threatIntelRoutes = require('./routes/threat-intel');
const educationRoutes = require('./routes/education');
const bugBountyRoutes = require('./routes/bug-bounty');
const { authenticateApiKey } = require('./middleware/api-key-auth');

// API key authentication (runs before JWT auth on all /api routes)
app.use('/api', authenticateApiKey);

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
app.use('/api/voice-clone', voiceCloneRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/estate', estateRoutes);
app.use('/api/sso', ssoRoutes);
app.use('/api/platform', apiPlatformRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/threat-intel', threatIntelRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/bug-bounty', bugBountyRoutes);
app.use('/api/whitelabel', whitelabelRoutes);

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
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
    },
    cpu: {
      usage: process.cpuUsage(),
      loadAvg: require('os').loadavg(),
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid,
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

  // Redis health check
  try {
    const { getRedisConnection } = require('./services/queue');
    const redis = getRedisConnection();
    if (redis && redis.status === 'ready') {
      health.redis = { status: 'ok' };
    } else {
      health.redis = { status: 'unavailable', fallback: 'in-memory' };
    }
  } catch {
    health.redis = { status: 'unavailable', fallback: 'in-memory' };
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

  // WebSocket health
  try {
    const websocket = require('./services/websocket');
    health.websocket = { status: 'ok', connections: websocket.getConnectionCount?.() || 0 };
  } catch {
    health.websocket = { status: 'unavailable' };
  }

  // Event bus health
  try {
    const eventBus = require('./services/event-bus');
    health.eventBus = { status: 'ok', listenerCount: eventBus.listenerCount?.('test') || 0 };
  } catch {
    health.eventBus = { status: 'unavailable' };
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Metrics endpoint for monitoring dashboards
app.get('/api/metrics', async (req, res) => {
  try {
    const { table } = require('./db/query');
    const now = Date.now();
    const oneHourAgo = new Date(now - 3600000).toISOString();
    const oneDayAgo = new Date(now - 86400000).toISOString();

    // Count records
    let alertsTotal = 0, takedownsTotal = 0, usersTotal = 0, scansToday = 0;
    try {
      const alerts = await table('alerts');
      const allAlerts = await alerts.all();
      alertsTotal = Array.isArray(allAlerts) ? allAlerts.length : 0;
    } catch (_) {}
    try {
      const takedowns = await table('takedowns');
      const allTakedowns = await takedowns.all();
      takedownsTotal = Array.isArray(allTakedowns) ? allTakedowns.length : 0;
    } catch (_) {}
    try {
      const users = await table('users');
      const allUsers = await users.all();
      usersTotal = Array.isArray(allUsers) ? allUsers.length : 0;
    } catch (_) {}
    try {
      const usage = await table('api_usage_logs');
      const allUsage = await usage.all();
      scansToday = Array.isArray(allUsage) ? allUsage.filter(l => l.created_at > oneDayAgo).length : 0;
    } catch (_) {}

    res.json({
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memory: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      counts: {
        alerts: alertsTotal,
        takedowns: takedownsTotal,
        users: usersTotal,
        apiRequestsToday: scansToday,
      },
      errorRates: {
        '4xx': _errorCounts['4xx'],
        '5xx': _errorCounts['5xx'],
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

  // ─── HTTP + WebSocket Server ───
  const http = require('http');
  const server = http.createServer(app);

  // Attach WebSocket server
  try {
    const ws = require('./services/websocket');
    ws.init(server);
    console.log('[WS] WebSocket attached to HTTP server');
  } catch (e) {
    console.warn('[WS] WebSocket init failed:', e.message);
  }

  // Initialize job queue workers
  try {
    const { getQueue, QUEUES, JobTypes, createWorker } = require('./services/queue');
    const crawler = require('./services/crawler');

    // Deep scan worker
    createWorker(QUEUES.DEEP_SCAN, async (job) => {
      const { userId, userName } = job.data;
      const { emitScanProgress, emitScanCompleted, emitScanFailed } = require('./services/event-bus');
      emitScanProgress(userId, job.id, { stage: 'started', percent: 0 });
      try {
        const results = await crawler.scanCycle(userId, userName);
        emitScanCompleted(userId, 'deep', results);
        return results;
      } catch (e) {
        emitScanFailed(userId, 'deep', e);
        throw e;
      }
    }, { concurrency: 2 });

    console.log('[QUEUE] Workers initialized');
  } catch (e) {
    console.warn('[QUEUE] Worker init warning:', e.message);
  }

  server.listen(PORT, () => {
    console.log(`Enclave API running on http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
