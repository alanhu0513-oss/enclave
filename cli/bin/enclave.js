#!/usr/bin/env node

/* ─── Enclave CLI ───
 * Scan images, text, and URLs for deepfakes from the command line.
 *
 * Usage:
 *   enclave scan image photo.jpg
 *   enclave scan text "suspicious message"
 *   enclave scan url https://example.com
 *   enclave status
 *   enclave alerts
 */

const { program } = require('commander');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.ENCLAVE_API_URL || 'https://enclave-production-d818.up.railway.app';
const API_KEY = process.env.ENCLAVE_API_KEY || '';

async function apiRequest(method, endpoint, body, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
        ...headers,
      },
      signal: controller.signal,
      body: body ? JSON.stringify(body) : undefined,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Error ${res.status}: ${text.slice(0, 200)}`);
      process.exit(1);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      console.error('Request timed out');
      process.exit(1);
    }
    console.error(e.message);
    process.exit(1);
  }
}

function printResult(result) {
  if (result.confidence !== undefined) {
    const color = result.confidence >= 60 ? '\x1b[31m' : result.confidence >= 35 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`\n${color}Verdict: ${result.verdict}${reset}`);
    console.log(`Confidence: ${result.confidence}%`);
    console.log(`Provider: ${result.provider || 'unknown'}`);
    if (result.explanation) console.log(`Explanation: ${result.explanation}`);
    if (result.face_count) console.log(`Faces detected: ${result.face_count}`);
    if (result.artifacts?.length) console.log(`Artifacts: ${result.artifacts.join(', ')}`);
    console.log(`Latency: ${result.latency_ms || 0}ms`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

program
  .name('enclave')
  .description('Enclave Identity Protection CLI')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan content for deepfakes')
  .argument('<type>', 'Type: image, text, url')
  .argument('<input>', 'File path, text string, or URL')
  .action(async (type, input) => {
    console.log(`Scanning ${type}...`);

    if (type === 'image') {
      const filePath = path.resolve(input);
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }
      const buffer = fs.readFileSync(filePath);
      const FormData = (globalThis).FormData;
      const Blob = (globalThis).Blob;

      if (FormData && Blob) {
        const form = new FormData();
        form.append('file', new Blob([buffer]), path.basename(filePath));
        const res = await fetch(`${BASE_URL}/api/detect/image`, {
          method: 'POST',
          headers: { ...(API_KEY ? { 'X-API-Key': API_KEY } : {}) },
          body: form,
        });
        const result = await res.json();
        printResult(result);
      } else {
        console.error('FormData not available. Use Node.js 18+ or pass --api-key with a remote server.');
        process.exit(1);
      }
    } else if (type === 'text') {
      const result = await apiRequest('POST', '/api/detect/text', { text: input });
      printResult(result);
    } else if (type === 'url') {
      const result = await apiRequest('POST', '/api/alerts/scan/url', { url: input });
      printResult(result);
    } else {
      console.error(`Unknown scan type: ${type}. Use image, text, or url.`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check API health status')
  .action(async () => {
    const result = await apiRequest('GET', '/api/health');
    console.log('\nEnclave Health Status:');
    console.log(`  Status: ${result.status}`);
    console.log(`  Version: ${result.version}`);
    console.log(`  Uptime: ${result.uptime}s`);
    console.log(`  DB: ${result.db?.status || 'unknown'}`);
    console.log(`  ML: ${result.ml?.status || 'unknown'}`);
    console.log(`  Memory: ${result.memory?.heapUsed || 0}MB`);
  });

program
  .command('alerts')
  .description('List recent alerts')
  .option('-l, --limit <n>', 'Number of alerts', '10')
  .action(async (opts) => {
    const result = await apiRequest('GET', `/api/alerts?limit=${opts.limit}`);
    const alerts = result.alerts || result.data?.alerts || [];
    if (alerts.length === 0) {
      console.log('\nNo alerts found.');
      return;
    }
    console.log(`\nRecent Alerts (${alerts.length}):`);
    for (const a of alerts.slice(0, parseInt(opts.limit))) {
      const icon = a.severity === 'critical' ? '🔴' : a.severity === 'high' ? '🟠' : '🟡';
      console.log(`  ${icon} ${a.title || a.type} [${a.status}] - ${a.created_at}`);
    }
  });

program
  .command('takedowns')
  .description('List takedowns')
  .action(async () => {
    const result = await apiRequest('GET', '/api/takedowns');
    const takedowns = result.takedowns || result.data?.takedowns || [];
    if (takedowns.length === 0) {
      console.log('\nNo takedowns found.');
      return;
    }
    console.log(`\nTakedowns (${takedowns.length}):`);
    for (const t of takedowns) {
      console.log(`  ${t.status} - ${t.type} - ${t.created_at}`);
    }
  });

program
  .command('init')
  .description('Initialize CLI configuration')
  .action(() => {
    const configPath = path.join(process.env.HOME || '~', '.enclaverc');
    const config = {
      baseUrl: BASE_URL,
      apiKey: API_KEY,
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\nConfiguration saved to ${configPath}`);
    console.log('Set ENCLAVE_API_KEY environment variable for authenticated requests.');
  });

program.parse();
