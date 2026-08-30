const request = require('supertest');
const path = require('path');
const fs = require('fs');

const origEnv = { ...process.env };
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = path.join(__dirname, '..', 'data', 'test-billing.json');
process.env.JWT_SECRET = 'test-secret-for-ci';
process.env.PORT = '0';
process.env.STRIPE_SECRET_KEY = '';

const testDb = process.env.DATABASE_PATH;
try { fs.unlinkSync(testDb); } catch (_) {}

const app = require('../src/index');
const { resetEngine } = require('../src/db/adapter');

beforeAll(() => { resetEngine(); });
afterAll(() => {
  try { fs.unlinkSync(testDb); } catch (_) {}
  process.env = origEnv;
});

describe('A.1 Revenue-critical billing smoke test (mock checkout -> activate -> unlock)', () => {
  const EMAIL = 'paying@example.com';
  const PASS = 'Paying123!';
  let token;

  beforeAll(async () => {
    await request(app).post('/api/auth/register')
      .send({ email: EMAIL, password: PASS, fullName: 'Paying User' });
    const res = await request(app).post('/api/auth/login')
      .send({ email: EMAIL, password: PASS });
    token = res.body.data.token;
  });

  it('new user starts on free tier with a scan limit of 3', async () => {
    const sub = await request(app)
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${token}`);
    expect(sub.status).toBe(200);
    expect(sub.body.data.subscription.tier).toBe('free');

    const usage = await request(app)
      .get('/api/billing/usage')
      .set('Authorization', `Bearer ${token}`);
    expect(usage.status).toBe(200);
    expect(usage.body.data.scans.limit).toBe(3);
  });

  it('free tier rejects an over-limit scan with 429', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/alerts/scan/url')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: `http://example.com/free-${i}.jpg` });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app)
      .post('/api/alerts/scan/url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com/free-over.jpg' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Upgrade to continue/i);
  });

  it('creates a checkout session for the pro tier (mock activates immediately)', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ tier: 'pro', successUrl: 'http://localhost:3000/billing/success', cancelUrl: 'http://localhost:3000/billing/cancel' });
    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toMatch(/^mock_sess_/);
    expect(res.body.data.mock).toBe(true);

    const sub = await request(app)
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${token}`);
    expect(sub.status).toBe(200);
    expect(sub.body.data.subscription.tier).toBe('pro');
    expect(sub.body.data.subscription.status).toBe('active');
  });

  it('after activating pro, usage unlocks to the pro scan limit (50)', async () => {
    const usage = await request(app)
      .get('/api/billing/usage')
      .set('Authorization', `Bearer ${token}`);
    expect(usage.status).toBe(200);
    expect(usage.body.data.scans.limit).toBe(50);
  });

  it('continues allowing scans after the activation (no longer free-tier gated)', async () => {
    const res = await request(app)
      .post('/api/alerts/scan/url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com/post-upgrade.jpg' });
    expect(res.status).toBe(200);
  });
});
