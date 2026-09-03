/* ─── Enclave SDK ───
 * Official JavaScript/TypeScript SDK for the Enclave Identity Protection API.
 *
 * Usage:
 *   import { EnclaveClient } from '@enclave/sdk';
 *   const client = new EnclaveClient({ apiKey: 'env_xxx' });
 *   const result = await client.detectImage(buffer);
 */

interface EnclaveConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

interface DetectionResult {
  confidence: number;
  verdict: string;
  provider: string;
  latency_ms: number;
  explanation?: string;
  artifacts?: string[];
  face_count?: number;
  cached?: boolean;
}

interface Alert {
  id: string;
  type: string;
  title: string;
  description?: string;
  severity: string;
  confidence: number;
  status: string;
  created_at: string;
}

interface HealthStatus {
  status: string;
  version: string;
  uptime: number;
  db: { status: string; engine?: string };
  ml: { status: string; models?: Record<string, any> };
}

export class EnclaveClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: EnclaveConfig = {}) {
    this.baseUrl = (config.baseUrl || process.env.ENCLAVE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
    this.apiKey = config.apiKey || process.env.ENCLAVE_API_KEY || '';
    this.timeout = config.timeout || 60000;
  }

  private async request<T>(method: string, path: string, body?: any, headers?: Record<string, string>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
          ...headers,
        },
        signal: controller.signal,
        body: body ? JSON.stringify(body) : undefined,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Enclave API ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      return data.data || data;
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') throw new Error('Enclave API request timed out');
      throw e;
    }
  }

  // ─── Detection ───

  async detectImage(buffer: Buffer | Uint8Array, filename?: string): Promise<DetectionResult> {
    const FormData = (globalThis as any).FormData;
    const Blob = (globalThis as any).Blob;

    if (FormData) {
      const form = new FormData();
      form.append('file', new Blob([buffer]), filename || 'image.jpg');
      const url = `${this.baseUrl}/api/detect/image`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}) },
        body: form,
      });
      return res.json();
    }

    // Fallback for Node.js without FormData
    return this.request<DetectionResult>('POST', '/api/detect/image');
  }

  async detectText(text: string): Promise<any> {
    return this.request('POST', '/api/detect/text', { text });
  }

  async detectAudio(buffer: Buffer | Uint8Array, filename?: string): Promise<any> {
    return this.request('POST', '/api/detect/audio', { file: buffer.toString('base64'), filename });
  }

  async scanUrl(url: string): Promise<any> {
    return this.request('POST', '/api/alerts/scan/url', { url });
  }

  // ─── Alerts ───

  async listAlerts(params?: { status?: string; limit?: number }): Promise<{ alerts: Alert[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request('GET', `/api/alerts?${query.toString()}`);
  }

  async getAlert(id: string): Promise<Alert> {
    return this.request('GET', `/api/alerts/${id}`);
  }

  async whitelistAlert(id: string): Promise<any> {
    return this.request('PATCH', `/api/alerts/${id}/whitelist`);
  }

  // ─── Takedowns ───

  async initiateTakedown(alertId: string, type: string = 'dmca'): Promise<any> {
    return this.request('POST', `/api/takedowns/${alertId}/initiate`, { type });
  }

  async listTakedowns(): Promise<any> {
    return this.request('GET', '/api/takedowns');
  }

  // ─── Monitoring ───

  async startMonitoring(): Promise<any> {
    return this.request('POST', '/api/monitoring/start');
  }

  async stopMonitoring(): Promise<any> {
    return this.request('POST', '/api/monitoring/stop');
  }

  // ─── Notifications ───

  async listNotifications(params?: { unread?: boolean; limit?: number }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.unread) query.set('unread', 'true');
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request('GET', `/api/notifications?${query.toString()}`);
  }

  // ─── Health ───

  async health(): Promise<HealthStatus> {
    return this.request('GET', '/api/health');
  }

  // ─── Billing ───

  async getSubscription(): Promise<any> {
    return this.request('GET', '/api/billing/subscription');
  }

  async createCheckout(tier: string): Promise<any> {
    return this.request('POST', '/api/billing/checkout', { tier });
  }

  // ─── API Keys ───

  async listApiKeys(): Promise<any> {
    return this.request('GET', '/api/platform/keys');
  }

  async createApiKey(name: string, permissions?: string[]): Promise<any> {
    return this.request('POST', '/api/platform/keys', { name, permissions });
  }

  // ─── Webhooks ───

  async listWebhooks(): Promise<any> {
    return this.request('GET', '/api/platform/webhooks');
  }

  async createWebhook(url: string, events: string[]): Promise<any> {
    return this.request('POST', '/api/platform/webhooks', { url, events });
  }

  async testWebhook(id: string): Promise<any> {
    return this.request('POST', `/api/platform/webhooks/${id}/test`);
  }
}

export default EnclaveClient;
