export interface EnclaveOptions {
  apiUrl?: string;
  apiKey?: string;
}

export interface ScanResult {
  score: number;
  confidence: number;
  verdict: string;
  details?: string;
}

export interface Shield {
  id: string;
  name: string;
  enabled: boolean;
  type: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: string;
  url: string;
  confidence: number;
  createdAt: string;
}

export interface Takedown {
  id: string;
  url: string;
  status: string;
  createdAt: string;
}

export class EnclaveClient {
  constructor(options?: EnclaveOptions);

  scanFile(filePath: string, type?: string): Promise<ScanResult>;
  scanUrl(url: string, type?: string): Promise<ScanResult>;

  getShields(): Promise<{ shields: Shield[] }>;
  toggleShield(shieldId: string, enabled: boolean): Promise<void>;

  getAlerts(params?: Record<string, string>): Promise<{ alerts: Alert[] }>;
  getAlert(alertId: string): Promise<{ alert: Alert }>;

  createTakedown(data: { url: string; reason: string }): Promise<Takedown>;
  getTakedowns(): Promise<{ takedowns: Takedown[] }>;

  getInsurancePlans(): Promise<any>;
  subscribeInsurance(planId: string): Promise<any>;

  enrollPassport(data: any): Promise<any>;
  verifyPassport(passportId: string): Promise<any>;

  health(): Promise<{ status: string }>;
}
