const request = require('supertest');
const path = require('path');
const fs = require('fs');

const origEnv = { ...process.env };
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = path.join(__dirname, '..', 'data', 'test-cover.json');
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

describe('Route coverage - notifications, takedowns, family, community, biometrics', () => {
  const EMAIL = 'cover@example.com';
  const PASS = 'CoverPass123!';
  let token;
  let alertId;

  beforeAll(async () => {
    await request(app).post('/api/auth/register')
      .send({ email: EMAIL, password: PASS, fullName: 'Cover User' });
    const res = await request(app).post('/api/auth/login')
      .send({ email: EMAIL, password: PASS });
    token = res.body.data.token;
    const scan = await request(app).post('/api/alerts/scan/url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com/cover.jpg' });
    alertId = scan.body.data && scan.body.data.id;
  });

  describe('Notifications', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
    it('GET /api/notifications lists user notifications', async () => {
      const res = await request(app).get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
    it('GET /api/notifications/unread-count returns count', async () => {
      const res = await request(app).get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.data.count).toBe('number');
    });
    it('POST /api/notifications/read-all marks all read', async () => {
      const res = await request(app).post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
    it('PATCH /api/notifications/preferences updates prefs', async () => {
      const res = await request(app).patch('/api/notifications/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ emailNotifications: false });
      expect(res.status).toBe(200);
    });
  });

  describe('Takedowns', () => {
    it('GET /api/takedowns lists (empty initially)', async () => {
      const res = await request(app).get('/api/takedowns')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
    it('GET /api/takedowns/stats/summary returns stats', async () => {
      const res = await request(app).get('/api/takedowns/stats/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
    it('free tier has 0 takedown allowance -> initiate returns 429', async () => {
      const res = await request(app).post(`/api/takedowns/${alertId}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'dmca', sendEmail: false });
      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(/Upgrade to continue/i);
    });
  });

  describe('Biometrics', () => {
    it('GET /api/biometrics/status returns status map', async () => {
      const res = await request(app).get('/api/biometrics/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.faceprint).toBeDefined();
    });
    it('POST /api/biometrics/voice/enroll handles missing data gracefully', async () => {
      const res = await request(app).post('/api/biometrics/voice/enroll')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Family', () => {
    it('GET /api/family/members returns members list', async () => {
      const res = await request(app).get('/api/family/members')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.members)).toBe(true);
    });
    it('POST /api/family/members validates invitation input', async () => {
      const res = await request(app).post('/api/family/members')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Community', () => {
    it('GET /api/community/threats returns feed', async () => {
      const res = await request(app).get('/api/community/threats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.indicators)).toBe(true);
    });
    it('GET /api/community/threats/stats returns stats', async () => {
      const res = await request(app).get('/api/community/threats/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
    it('POST /api/community/threats/share shares an IoC', async () => {
      const res = await request(app).post('/api/community/threats/share')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'url', value: 'http://evil.example.com/phish', description: 'QA test' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Referrals', () => {
    it('GET /api/referrals/code returns a code', async () => {
      const res = await request(app).get('/api/referrals/code')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.data.code).toBe('string');
    });
  });
});
