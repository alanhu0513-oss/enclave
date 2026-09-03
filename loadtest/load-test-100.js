/* ─── Enclave Load Test — 100 Concurrent Users ───
 * Run with: k6 run loadtest/load-test-100.js
 * Tests API performance under moderate load.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.ENCLAVE_API_URL || 'http://localhost:4000';
const API_KEY = __ENV.ENCLAVE_API_KEY || '';

const errorRate = new Rate('errors');
const reqDuration = new Trend('req_duration', true);
const reqCount = new Counter('req_count');

export const options = {
  stages: [
    { duration: '1m', target: 25 },    // Ramp up to 25 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% under 1s
    http_req_duration: ['p(99)<2000'],  // 99% under 2s
    errors: ['rate<0.05'],              // Less than 5% errors
  },
};

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

let authToken = null;

export default function () {
  const iteration = __VU;

  // Health check (no auth required)
  const healthRes = http.get(`${BASE_URL}/api/health`, { headers: headers() });
  check(healthRes, {
    'health 200': (r) => r.status === 200,
  });
  errorRate.add(healthRes.status !== 200);
  reqDuration.add(healthRes.timings.duration);
  reqCount.add(1);

  sleep(Math.random() * 2);

  // Register unique user
  const email = `load100_${Date.now()}_${iteration}@test.com`;
  const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email,
    password: 'LoadTest123!',
    fullName: `Load Test ${iteration}`,
  }), { headers: headers() });
  reqCount.add(1);

  sleep(0.3);

  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email,
    password: 'LoadTest123!',
  }), { headers: headers() });
  errorRate.add(loginRes.status !== 200);
  reqDuration.add(loginRes.timings.duration);
  reqCount.add(1);

  const token = loginRes.json('data')?.token || loginRes.json('token');
  if (!token) return;

  const authHeaders = { ...headers(), Authorization: `Bearer ${token}` };

  // Simulate realistic user behavior
  const actions = [
    () => {
      const res = http.get(`${BASE_URL}/api/alerts?limit=10`, { headers: authHeaders });
      check(res, { 'alerts 200': (r) => r.status === 200 });
      errorRate.add(res.status !== 200);
      reqDuration.add(res.timings.duration);
    },
    () => {
      const res = http.get(`${BASE_URL}/api/notifications`, { headers: authHeaders });
      check(res, { 'notifications 200': (r) => r.status === 200 });
      errorRate.add(res.status !== 200);
      reqDuration.add(res.timings.duration);
    },
    () => {
      const res = http.get(`${BASE_URL}/api/billing/subscription`, { headers: authHeaders });
      check(res, { 'billing 200': (r) => r.status === 200 });
      errorRate.add(res.status !== 200);
      reqDuration.add(res.timings.duration);
    },
    () => {
      const res = http.get(`${BASE_URL}/api/takedowns`, { headers: authHeaders });
      check(res, { 'takedowns 200': (r) => r.status === 200 });
      errorRate.add(res.status !== 200);
      reqDuration.add(res.timings.duration);
    },
    () => {
      const res = http.get(`${BASE_URL}/api/platform/keys`, { headers: authHeaders });
      check(res, { 'api-keys 200': (r) => r.status === 200 });
      errorRate.add(res.status !== 200);
      reqDuration.add(res.timings.duration);
    },
    () => {
      const res = http.get(`${BASE_URL}/api/education/blog`, { headers: authHeaders });
      check(res, { 'blog 200': (r) => r.status === 200 });
      errorRate.add(res.status !== 200);
      reqDuration.add(res.timings.duration);
    },
  ];

  // Execute 2-4 random actions
  const numActions = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numActions; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    action();
    sleep(Math.random() * 2 + 0.5);
    reqCount.add(1);
  }
}
