const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Prevent dotenv from loading .env (which has DATABASE_URL for local dev)
// by setting env vars BEFORE any require of src/index
const origEnv = { ...process.env };
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = path.join(__dirname, '..', 'data', 'test-enclave.json');
process.env.JWT_SECRET = 'test-secret-for-ci';
process.env.PORT = '0';

// Clean test DB
const testDb = process.env.DATABASE_PATH;
try { fs.unlinkSync(testDb); } catch (_) {}

const app = require('../src/index');
const { resetEngine } = require('../src/db/adapter');

beforeAll(() => {
  resetEngine();
});

afterAll(() => {
  try { fs.unlinkSync(testDb); } catch (_) {}
  process.env = origEnv;
});

describe('Health Check', () => {
  it('GET /api/health returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
  });
});

describe('Auth - Register', () => {
  it('POST /api/auth/register creates a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'TestPass123!', fullName: 'Test User' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('POST /api/auth/register rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'TestPass123!', fullName: 'Test User' });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/register rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: '123', fullName: 'Short Pass' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'missing@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('Auth - Login', () => {
  it('POST /api/auth/login returns token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'TestPass123!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('POST /api/auth/login rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'WrongPassword!' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login rejects non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'TestPass123!' });
    expect(res.status).toBe(401);
  });
});

describe('Auth - Forgot Password', () => {
  it('POST /api/auth/forgot-password accepts valid email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/forgot-password returns success for non-existent email (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });

  it('POST /api/auth/forgot-password rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('Auth - Reset Password', () => {
  it('POST /api/auth/reset-password rejects invalid code', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'test@example.com', code: '000000', newPassword: 'NewPass123!' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/reset-password rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('Auth - Google', () => {
  it('POST /api/auth/google returns 400 without credential', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/google returns error with invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'invalid-google-token' });
    expect([400, 401, 500]).toContain(res.status);
  });
});

describe('Protected Routes', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'TestPass123!' });
    token = res.body.data.token;
  });

  it('GET /api/alerts requires authentication', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(401);
  });

  it('GET /api/alerts returns empty list for new user', async () => {
    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/user/data requires authentication', async () => {
    const res = await request(app).get('/api/user/data');
    expect(res.status).toBe(401);
  });

  it('GET /api/user/data returns user profile', async () => {
    const res = await request(app)
      .get('/api/user/data')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('POST /api/alerts/scan/url requires authentication', async () => {
    const res = await request(app)
      .post('/api/alerts/scan/url')
      .send({ url: 'http://example.com' });
    expect(res.status).toBe(401);
  });

  it('GET /api/detect/status requires authentication', async () => {
    const res = await request(app).get('/api/detect/status');
    expect(res.status).toBe(401);
  });

  it('GET /api/detect/status returns provider health', async () => {
    const res = await request(app)
      .get('/api/detect/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.gemini).toBeDefined();
    expect(typeof res.body.data.gemini.configured).toBe('boolean');
    expect(res.body.data.gemini.primary.model).toBeDefined();
    expect(res.body.data.gemini.cache.entries).toBeGreaterThanOrEqual(0);
    expect(res.body.data.pythonService).toBeDefined();
  });

  it('POST /api/detect/text rejects missing text', async () => {
    const res = await request(app)
      .post('/api/detect/text')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 503]).toContain(res.status);
  });

  it('POST /api/alerts/scan/url rejects missing URL', async () => {
    const res = await request(app)
      .post('/api/alerts/scan/url')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/alerts/scan/url scans a URL', async () => {
    const res = await request(app)
      .post('/api/alerts/scan/url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com/test-image.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.sourceUrl).toBe('http://example.com/test-image.jpg');
    expect(typeof res.body.data.confidence).toBe('number');
  });

  it('POST /api/alerts/deep-scan triggers a scan', async () => {
    const res = await request(app)
      .post('/api/alerts/deep-scan')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.count).toBe('number');
  }, 30000);
});

describe('Crawler', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'TestPass123!' });
    token = res.body.data.token;
  });

  it('GET /api/crawler/status returns status', async () => {
    const res = await request(app)
      .get('/api/crawler/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.active).toBe('boolean');
  });

  it('POST /api/crawler/start starts crawler', async () => {
    const res = await request(app)
      .post('/api/crawler/start')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(true);
  });

  it('POST /api/crawler/stop stops crawler', async () => {
    const res = await request(app)
      .post('/api/crawler/stop')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Monitoring', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'TestPass123!' });
    token = res.body.data.token;
  });

  it('GET /api/monitoring/status requires authentication', async () => {
    const res = await request(app).get('/api/monitoring/status');
    expect(res.status).toBe(401);
  });

  it('GET /api/monitoring/status returns tier, schedule and sources', async () => {
    const res = await request(app)
      .get('/api/monitoring/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBeDefined();
    expect(typeof res.body.data.schedule).toBe('string');
    expect(Array.isArray(res.body.data.sources)).toBe(true);
    expect(res.body.data.sources.length).toBeGreaterThanOrEqual(5);
    for (const src of res.body.data.sources) {
      expect(src.id).toBeDefined();
      expect(src.label).toBeDefined();
      expect(['idle', 'ok', 'degraded', 'down', 'cooldown', 'locked']).toContain(src.status);
    }
    // Free tier: darkweb + social must be locked
    const ids = res.body.data.sources.map((s) => s.id);
    const darkweb = res.body.data.sources[ids.indexOf('darkweb')];
    const social = res.body.data.sources[ids.indexOf('social')];
    expect(darkweb.enabled).toBe(false);
    expect(darkweb.status).toBe('locked');
    expect(social.enabled).toBe(false);
    expect(social.fragile).toBe(true);
  });

  it('POST /api/monitoring/start then /stop toggles session', async () => {
    const startRes = await request(app)
      .post('/api/monitoring/start')
      .set('Authorization', `Bearer ${token}`);
    expect(startRes.status).toBe(200);

    const statusRes = await request(app)
      .get('/api/monitoring/status')
      .set('Authorization', `Bearer ${token}`);
    expect(statusRes.body.data.active).toBe(true);

    const stopRes = await request(app)
      .post('/api/monitoring/stop')
      .set('Authorization', `Bearer ${token}`);
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.data.stopped).toBe(true);
  });

  it('POST /api/monitoring/run-once rejects users without registered name or completes cleanly', async () => {
    const res = await request(app)
      .post('/api/monitoring/run-once')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 400]).toContain(res.status);
  }, 60000);
});
