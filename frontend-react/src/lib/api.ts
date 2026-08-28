const TOKEN_KEY = "enclave_jwt";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (typeof window !== "undefined" && window.sessionStorage.getItem("enclave_api_url")) ??
  "/api";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string, remember: boolean = false) {
  // Remembered tokens persist across sessions (localStorage).
  // Non-remembered tokens live only in sessionStorage and clear when the tab closes.
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function apiFetch<T = any>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  if (init?.body && typeof init.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(API_BASE + path, { ...init, headers });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && (data as any).error) ||
      (data && typeof data === "object" && (data as any).message) ||
      (typeof data === "string" && data) ||
      `Request failed (${res.status})`;
    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  // Normalize to the data payload when present
  if (data && typeof data === "object" && "data" in data) {
    return (data as any).data as T;
  }
  return data as T;
}

function post<T = any>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function form<T = any>(path: string, fd: FormData): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: fd });
}

export const api = {
  // Auth
  register: (email: string, password: string, fullName: string) =>
    post("/auth/register", { email, password, fullName }),
  login: (email: string, password: string) =>
    post<{ token: string }>("/auth/login", { email, password }),
  forgotPassword: (email: string) => post("/auth/forgot-password", { email }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    post("/auth/reset-password", { email, code, newPassword }),
  googleAuth: (credential: string) => post("/auth/google", { credential }),
  verifyPassword: (password: string) =>
    post<{ verified: boolean }>("/auth/verify-password", { password }),
  logout: () => post("/auth/logout"),
  changePassword: (currentPassword: string, newPassword: string) =>
    post("/auth/change-password", { currentPassword, newPassword }),

  // Biometrics
  uploadFace: (file: File, width?: number, height?: number) => {
    const fd = new FormData();
    fd.append("face", file);
    fd.append("width", String(width || 64));
    fd.append("height", String(height || 48));
    return form("/biometrics/face", fd);
  },
  uploadVoice: (file: File | null, profile: unknown[], meta: any) => {
    const fd = new FormData();
    if (file) fd.append("voice", file);
    fd.append("profile", JSON.stringify(profile || []));
    fd.append("bins", String(meta.bins || 64));
    fd.append("sampleRate", String(meta.sampleRate || 44100));
    fd.append("fftSize", String(meta.fftSize || 128));
    fd.append("frames", String(meta.frames || 0));
    fd.append("durationMs", String(meta.durationMs || 10000));
    return form("/biometrics/voice", fd);
  },
  uploadSignature: (file: File) => {
    const fd = new FormData();
    fd.append("signature", file);
    return form("/biometrics/signature", fd);
  },
  getBiometricStatus: () => apiFetch("/biometrics/status"),

  // Detection
  detectImage: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return form("/detect/image", fd);
  },
  detectUrl: (url: string) => post("/detect/url", { url }),
  detectText: (text: string) => post("/detect/text", { text }),
  reverseImageSearch: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return form("/detect/reverse", fd);
  },
  getDetectStatus: () => apiFetch("/detect/status"),

  // Alerts
  getAlerts: () => apiFetch<Alert[]>(`/alerts`),
  scanUrl: (url: string) => post("/alerts/scan/url", { url }),
  scanImage: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return form("/alerts/scan/image", fd);
  },
  deepScan: () => post("/alerts/deep-scan"),
  whitelistAlert: (id: string) =>
    apiFetch(`/alerts/${id}/whitelist`, { method: "PATCH" }),
  generateDocument: (alertId: string, type = "dmca") =>
    post(`/alerts/${alertId}/document`, { type }),
  deleteAlert: (id: string) =>
    apiFetch(`/alerts/${id}`, { method: "DELETE" }),
  embedWatermark: (file: File, copyright?: string) => {
    const fd = new FormData();
    fd.append("image", file);
    if (copyright) fd.append("copyright", copyright);
    return form("/alerts/watermark/embed", fd);
  },
  verifyWatermark: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return form("/alerts/watermark/verify", fd);
  },

  // Crawler
  getCrawlerStatus: () => apiFetch("/crawler/status"),
  startCrawler: () => post("/crawler/start"),
  stopCrawler: () => post("/crawler/stop"),

  // Monitoring
  getMonitoringStatus: () => apiFetch("/monitoring/status"),
  startMonitoring: () => post("/monitoring/start"),
  stopMonitoring: () => post("/monitoring/stop"),
  runMonitoringOnce: () => post("/monitoring/run-once"),
  checkIdentityChanges: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return form("/biometrics/identity-changes", fd);
  },

  // User
  getUserData: () => apiFetch<UserData>("/user/data"),
  deleteUserData: () => apiFetch("/user/data", { method: "DELETE" }),
  updateProfile: (fullName: string) =>
    apiFetch("/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ fullName }),
    }),

  // Notifications
  getNotifications: (opts?: { unreadOnly?: boolean; limit?: number }) => {
    const params: string[] = [];
    if (opts?.unreadOnly) params.push("unread=true");
    if (opts?.limit) params.push("limit=" + opts.limit);
    const qs = params.length ? "?" + params.join("&") : "";
    return apiFetch<Notification[]>(`/notifications${qs}`);
  },
  getUnreadCount: () => apiFetch<number>("/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => post("/notifications/read-all"),
  getNotificationPreferences: () =>
    apiFetch("/notifications/preferences"),
  updateNotificationPreferences: (prefs: any) =>
    apiFetch("/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    }),

  // Takedowns
  getTakedowns: () => apiFetch<Takedown[]>("/takedowns"),
  getTakedown: (id: string) => apiFetch(`/takedowns/${id}`),
  initiateTakedown: (
    alertId: string,
    type = "dmca",
    sendEmail = true,
  ) => post(`/takedowns/${alertId}/initiate`, { type, sendEmail }),
  getTakedownStats: () => apiFetch("/takedowns/stats/summary"),
  getTakedownEvidence: (id: string) =>
    apiFetch(`/takedowns/${id}/evidence`),
  getVerification: (id: string) =>
    apiFetch(`/takedowns/${id}/verification`),
  recordCounterNotice: (id: string, details = "") =>
    post(`/takedowns/${id}/counter-notice`, { details }),

  // Billing
  getSubscription: () => apiFetch("/billing/subscription"),
  getTiers: () => apiFetch<Tier[]>("/billing/tiers"),
  startCheckout: (tier: string, successUrl: string, cancelUrl: string) =>
    post("/billing/checkout", { tier, successUrl, cancelUrl }),
  createPortal: (returnUrl: string) =>
    post("/billing/portal", { returnUrl }),
  getUsage: () => apiFetch("/billing/usage"),

  // Shields
  getShieldStats: () => apiFetch("/shields/stats"),
  getShieldSummary: () => apiFetch("/shields/summary"),
  recordShieldEvent: (type: string, detail: string, status: string) =>
    post("/shields/record", { type, detail, status }),

  // Community
  getThreatShares: (opts?: { limit?: number; type?: string }) => {
    const params: string[] = [];
    if (opts?.limit) params.push("limit=" + opts.limit);
    if (opts?.type) params.push("iocType=" + opts.type);
    const qs = params.length ? "?" + params.join("&") : "";
    return apiFetch("/community/threats" + qs);
  },
  shareThreat: (data: any) => post("/community/threats/share", data),
  voteThreat: (id: string, vote: any) =>
    post(`/community/threats/${id}/vote`, { vote }),
  getForumPosts: (opts?: { limit?: number; category?: string }) => {
    const params: string[] = [];
    if (opts?.limit) params.push("limit=" + opts.limit);
    if (opts?.category) params.push("category=" + opts.category);
    const qs = params.length ? "?" + params.join("&") : "";
    return apiFetch("/community/forum/posts" + qs);
  },
  createForumPost: (data: any) => post("/community/forum/posts", data),
  getCommunityStats: () => apiFetch("/community/forum/stats"),
  getThreatStats: () => apiFetch("/community/threats/stats"),

  // Reports
  getReportTypes: () => apiFetch("/reports/types"),
  generateReport: (data: any) =>
    post("/reports/generate", data || { type: "threat_summary" }),
  scheduleReport: (data: any) => post("/reports/schedule", data),
  getReports: (limit?: number) =>
    apiFetch(`/reports` + (limit ? "?limit=" + limit : "")),
  getReportSchedules: () => apiFetch("/reports/schedules"),

  // Family
  listFamilyMembers: () => apiFetch("/family/members"),
  addFamilyMember: (data: any) => post("/family/members", data),
  updateFamilyMember: (id: string, data: any) =>
    apiFetch(`/family/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  removeFamilyMember: (id: string) =>
    apiFetch(`/family/members/${id}`, { method: "DELETE" }),
  getFamilyMemberAlerts: (id: string) =>
    apiFetch(`/family/members/${id}/alerts`),

  // Referrals
  getReferralCode: () => apiFetch("/referrals/code"),
  getReferralStats: () => apiFetch("/referrals/stats"),
  applyReferral: (code: string) => post("/referrals/apply", { code }),
  claimReferralReward: () => post("/referrals/claim"),

  // Health
  getHealth: () => apiFetch("/health"),

  getBaseUrl: () => API_BASE,
};

// ─── Types ───
export interface Alert {
  id: string;
  url?: string;
  image?: string;
  type?: string;
  description?: string;
  confidence?: number;
  status?: string;
  source_url?: string;
  created_at?: number;
  [key: string]: any;
}

export interface Takedown {
  id: string;
  platform?: string;
  type?: string;
  status?: string;
  created_at?: number;
  [key: string]: any;
}

export interface Tier {
  id: string;
  name?: string;
  price?: number;
  [key: string]: any;
}

export interface Notification {
  id: string;
  title?: string;
  body?: string;
  read?: boolean;
  created_at?: number;
  [key: string]: any;
}

export interface UserData {
  user?: {
    id: string;
    email: string;
    fullName?: string;
    plan?: string;
    [key: string]: any;
  };
  alerts?: Alert[];
  [key: string]: any;
}

export default api;
