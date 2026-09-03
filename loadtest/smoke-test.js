/* ─── Enclave Load Test ───
 * Run with: k6 run loadtest/smoke-test.js
 * Tests basic API endpoints under light load (5-10 concurrent users).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.ENCLAVE_API_URL || 'http://localhost:4000';
const API_KEY = __ENV.ENCLAVE_API_KEY || '';

const errorRate = new Rate('errors');
const latencyP95 = new Trend('latency_p95');

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '1m', target: 5 },    // Stay at 5 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    errors: ['rate<0.1'],              // Less than 10% errors
  },
};

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`, { headers: headers() });
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(healthRes.status !== 200);

  sleep(1);

  // Register
  const email = `loadtest_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email,
    password: 'LoadTest123!',
    fullName: 'Load Test User',
  }), { headers: headers() });
  check(registerRes, {
    'register status is 201 or 409': (r) => r.status === 201 || r.status === 409,
  });
  errorRate.add(registerRes.status !== 201 && registerRes.status !== 409);

  sleep(0.5);

  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email,
    password: 'LoadTest123!',
  }), { headers: headers() });
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
  });
  errorRate.add(loginRes.status !== 200);

  const token = loginRes.json('data')?.token || loginRes.json('token');
  if (token) {
    const authHeaders = { ...headers(), Authorization: `Bearer ${token}` };

    // List alerts
    const alertsRes = http.get(`${BASE_URL}/api/alerts?limit=10`, { headers: authHeaders });
    check(alertsRes, {
      'alerts status is 200': (r) => r.status === 200,
    });
    errorRate.add(alertsRes.status !== 200);

    sleep(0.5);

    // List notifications
    const notifRes = http.get(`${BASE_URL}/api/notifications`, { headers: authHeaders });
    check(notifRes, {
      'notifications status is 200': (r) => r.status === 200,
    });
    errorRate.add(notifRes.status !== 200);

    sleep(0.5);

    // Get subscription
    const billingRes = http.get(`${BASE_URL}/api/billing/subscription`, { headers: authHeaders });
    check(billingRes, {
      'billing status is 200': (r) => r.status === 200,
    });
    errorRate.add(billingRes.status !== 200);
  }

  sleep(1);
}
