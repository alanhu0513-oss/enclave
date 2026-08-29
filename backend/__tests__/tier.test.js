const request = require('supertest');
const path = require('path');
const fs = require('fs');

const origEnv = { ...process.env };
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = path.join(__dirname, '..', 'data', 'test-tier.json');
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

describe('Tier Enforcement - Free tier scan limit', () => {
  const EMAIL = 'tiercheck@example.com';
  const PASS = 'TierCheck123!';
  let token;

  beforeAll(async () => {
    await request(app).post('/api/auth/register')
      .send({ email: EMAIL, password: PASS, fullName: 'Tier Check' });
    const res = await request(app).post('/api/auth/login')
      .send({ email: EMAIL, password: PASS });
    token = res.body.data.token;
  });

  it('free tier allows up to 3 scans (200) then rejects with 429', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/alerts/scan/url')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'http://example.com/x.jpg' });
      expect(res.status).toBe(200);
    }
    // 4th scan exceeds free tier limit of 3
    const blocked = await request(app)
      .post('/api/alerts/scan/url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com/y.jpg' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.message).toMatch(/Upgrade to continue/i);
  });

  it('billing usage reflects scans and remaining limit', async () => {
    const res = await request(app)
      .get('/api/billing/usage')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    const scans = res.body.data.scans;
    expect(scans && typeof scans.remaining === 'number').toBe(true);
    expect(scans.remaining).toBe(0);
    expect(scans.limit).toBe(3);
  });
});
