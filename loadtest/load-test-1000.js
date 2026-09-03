/* ─── Enclave Load Test — 1000 Concurrent Users ───
 * Run with: k6 run loadtest/load-test-1000.js
 * Stress test for production readiness validation.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.ENCLAVE_API_URL || 'http://localhost:4000';
const API_KEY = __ENV.ENCLAVE_API_KEY || '';

const errorRate = new Rate('errors');
const reqDuration = new Trend('req_duration', true);
const reqCount = new Counter('req_count');
const authFailures = new Counter('auth_failures');

export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Warm up
    { duration: '3m', target: 500 },    // Ramp to 500
    { duration: '2m', target: 1000 },   // Ramp to 1000
    { duration: '5m', target: 1000 },   // Sustain 1000
    { duration: '2m', target: 500 },    // Scale down
    { duration: '1m', target: 0 },      // Cooldown
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // 95% under 2s
    http_req_duration: ['p(99)<5000'],   // 99% under 5s
    errors: ['rate<0.1'],                // Less than 10% errors
  },
};

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

// Pre-seeded user pool to avoid registration storms
const USER_POOL_SIZE = 200;
const users = [];

export function setup() {
  console.log('Setting up user pool...');
  const pool = [];
  for (let i = 0; i < USER_POOL_SIZE; i++) {
    const email = `stress_${i}@loadtest.enclave`;
    const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      email,
      password: 'StressTest123!',
      fullName: `Stress User ${i}`,
    }), { headers: headers() });

    if (res.status === 201 || res.status === 409) {
      const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email,
        password: 'StressTest123!',
      }), { headers: headers() });
      const token = loginRes.json('data')?.token || loginRes.json('token');
      if (token) pool.push(token);
    }
  }
  console.log(`Pool ready: ${pool.length} users`);
  return { pool };
}

export default function (data) {
  const pool = data.pool || [];
  if (pool.length === 0) return;

  // Random user from pool
  const token = pool[__VU % pool.length];
  const authHeaders = { ...headers(), Authorization: `Bearer ${token}` };

  // Health check (lightweight)
  if (__VU % 10 === 0) {
    const healthRes = http.get(`${BASE_URL}/api/health`, { headers: headers() });
    errorRate.add(healthRes.status !== 200);
    reqDuration.add(healthRes.timings.duration);
    reqCount.add(1);
  }

  // Mixed workload
  const endpoint = Math.random();

  if (endpoint < 0.3) {
    // 30% - List alerts
    const res = http.get(`${BASE_URL}/api/alerts?limit=5`, { headers: authHeaders });
    errorRate.add(res.status !== 200);
    reqDuration.add(res.timings.duration);
  } else if (endpoint < 0.5) {
    // 20% - Notifications
    const res = http.get(`${BASE_URL}/api/notifications?limit=10`, { headers: authHeaders });
    errorRate.add(res.status !== 200);
    reqDuration.add(res.timings.duration);
  } else if (endpoint < 0.65) {
    // 15% - Billing check
    const res = http.get(`${BASE_URL}/api/billing/subscription`, { headers: authHeaders });
    errorRate.add(res.status !== 200);
    reqDuration.add(res.timings.duration);
  } else if (endpoint < 0.8) {
    // 15% - Blog/education (public)
    const res = http.get(`${BASE_URL}/api/education/blog`, { headers: authHeaders });
    errorRate.add(res.status !== 200);
    reqDuration.add(res.timings.duration);
  } else if (endpoint < 0.9) {
    // 10% - API keys
    const res = http.get(`${BASE_URL}/api/platform/keys`, { headers: authHeaders });
    errorRate.add(res.status !== 200);
    reqDuration.add(res.timings.duration);
  } else {
    // 10% - Takedowns
    const res = http.get(`${BASE_URL}/api/takedowns`, { headers: authHeaders });
    errorRate.add(res.status !== 200);
    reqDuration.add(res.timings.duration);
  }

  reqCount.add(1);
  sleep(Math.random() * 3 + 0.5);
}

export function teardown(data) {
  console.log(`Test complete. Pool: ${data.pool?.length || 0} users`);
}
