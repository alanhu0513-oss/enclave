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
  sendVerification: (purpose: string = "general") =>
    post("/auth/send-verification", { purpose }),
  verifyEmail: (code: string, purpose: string = "general") =>
    post("/auth/verify-email", { code, purpose }),
  changeEmail: (newEmail: string, code: string) =>
    post("/auth/change-email", { newEmail, code }),
  deleteAccount: (password: string, code: string) =>
    post("/auth/delete-account", { password, code }),
  getLoginHistory: () =>
    apiFetch<any[]>("/auth/login-history"),
  get2FAStatus: () =>
    apiFetch<any>("/auth/2fa/status"),
  setup2FA: () =>
    post<any>("/auth/2fa/setup"),
  verify2FA: (code: string) =>
    post("/auth/2fa/verify", { code }),
  disable2FA: (code: string, password: string) =>
    post("/auth/2fa/disable", { code, password }),

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
  detectAudio: (file: File) => {
    const fd = new FormData();
    fd.append("audio", file);
    return form("/detect/audio", fd);
  },
  detectMultiFace: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return form("/detect/multi-face", fd);
  },
  detectVideo: (file: File) => {
    const fd = new FormData();
    fd.append("video", file);
    return form("/detect/video", fd);
  },

  // Voice Clone Detection
  analyzeVoiceClone: (file: File) => {
    const fd = new FormData();
    fd.append("audio", file);
    return form("/voice-clone/analyze", fd);
  },
  batchAnalyzeVoice: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("audio", f));
    return form("/voice-clone/batch", fd);
  },
  getVoiceCloneStats: () => apiFetch("/voice-clone/stats"),

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

  // Insurance
  getInsurancePlans: () => apiFetch("/insurance/plans"),
  getInsuranceStatus: () => apiFetch("/insurance/status"),
  subscribeInsurance: (planId: string) => post("/insurance/subscribe", { planId }),
  unsubscribeInsurance: () => post("/insurance/unsubscribe"),
  fileInsuranceClaim: (data: { alertId: string; description: string; damages?: number; evidenceUrls?: string[] }) =>
    post("/insurance/claim", data),
  getInsuranceClaims: () => apiFetch("/insurance/claims"),
  getInsuranceClaim: (claimId: string) => apiFetch(`/insurance/claims/${claimId}`),

  // Bounty
  getBountyProfile: () => apiFetch("/bounty/profile"),
  enrollBounty: (data: { faceImages: string[]; bountyAmount: number }) => post("/bounty/enroll", data),
  scanBounty: (data: { imageUrl: string; source?: string; sourceUrl?: string }) => post("/bounty/scan", data),
  getBountyMatches: () => apiFetch("/bounty/matches"),
  confirmBountyMatch: (scanId: string, confirmed: boolean) => post(`/bounty/matches/${scanId}/confirm`, { confirmed }),
  getBountyLeaderboard: () => apiFetch("/bounty/leaderboard"),
  getBountyStats: () => apiFetch("/bounty/stats"),

  // Bug Bounty Platform
  getVulnerabilities: (params?: { severity?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch(`/bug-bounty/vulnerabilities${query ? `?${query}` : ""}`);
  },
  submitVulnerability: (data: { title: string; severity: string; description: string; impact?: string; remediation?: string; proofOfConcept?: string }) => post("/bug-bounty/vulnerabilities", data),
  updateVulnerability: (vulnId: string, data: { status?: string; bounty?: number }) => apiFetch(`/bug-bounty/vulnerabilities/${vulnId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  getBugBountyLeaderboard: () => apiFetch("/bug-bounty/leaderboard"),
  getBugBountyTiers: () => apiFetch("/bug-bounty/tiers"),
  getHallOfFame: () => apiFetch("/bug-bounty/hall-of-fame"),
  getDisclosurePolicy: () => apiFetch("/bug-bounty/policy"),

  // Passport
  getPassport: () => apiFetch("/passport"),
  enrollPassport: () => post("/passport/enroll"),
  verifyPassport: (passportId: string) => apiFetch(`/passport/verify/${passportId}`),
  getPassportQR: () => post("/passport/qr"),
  verifyPassportQR: (qrData: string) => post("/passport/qr/verify", { qrData }),
  revokePassport: () => post("/passport/revoke"),

  // Watermark
  embedWatermark: (imageBase64: string) => post("/watermark/embed", { imageBase64 }),
  verifyWatermark: (imageBase64: string, userId?: string) => post("/watermark/verify", { imageBase64, userId }),

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

  // Estate
  getEstateProfiles: () => apiFetch("/estate"),
  enrollEstate: (data: { deceasedName: string; relationship: string; dateOfDeath?: string; email?: string; notes?: string }) =>
    post("/estate/enroll", data),
  removeEstate: (estateId: string) =>
    apiFetch(`/estate/${estateId}`, { method: "DELETE" }),
  getEstateTakedowns: (estateId: string) =>
    apiFetch(`/estate/${estateId}/takedowns`),
  initiateEstateTakedown: (estateId: string, data: { url: string; description?: string; type?: string }) =>
    post(`/estate/${estateId}/takedown`, data),
  memorializeEstate: (estateId: string, data: { platform: string; profileUrl: string }) =>
    post(`/estate/${estateId}/memorialize`, data),

  // SSO
  getSSOConfig: () => apiFetch("/sso/config"),
  configureSAML: (data: any) => post("/sso/saml/configure", data),
  configureOIDC: (data: any) => post("/sso/oidc/configure", data),
  initiateSSO: (data: { email?: string; provider?: string }) => post("/sso/initiate", data),
  testSSO: () => post("/sso/test"),
  scimProvision: (data: any) => post("/sso/scim/provision", data),
  getSSOAudit: () => apiFetch("/sso/audit"),

  // API Platform
  getApiKeys: () => apiFetch("/platform/keys"),
  createApiKey: (data: { name: string; permissions?: string[]; rateLimit?: number }) =>
    post("/platform/keys", data),
  revokeApiKey: (keyId: string) =>
    apiFetch(`/platform/keys/${keyId}`, { method: "DELETE" }),
  getApiUsage: () => apiFetch("/platform/usage"),
  getWebhooks: () => apiFetch("/platform/webhooks"),
  createWebhook: (data: { url: string; events: string[]; secret?: string }) =>
    post("/platform/webhooks", data),
  deleteWebhook: (webhookId: string) =>
    apiFetch(`/platform/webhooks/${webhookId}`, { method: "DELETE" }),
  testWebhook: (webhookId: string) => post(`/platform/webhooks/${webhookId}/test`),
  getRateLimits: () => apiFetch("/platform/rate-limits"),

  // ML
  getMLModels: () => apiFetch("/ml/models"),
  getMLModel: (modelId: string) => apiFetch(`/ml/models/${modelId}`),
  deployMLModel: (modelId: string) => post(`/ml/models/${modelId}/deploy`),
  rollbackMLModel: (modelId: string) => post(`/ml/models/${modelId}/rollback`),
  getMLBenchmarks: (modelId?: string) => apiFetch(`/ml/benchmarks${modelId ? `?modelId=${modelId}` : ""}`),
  getMLComparison: () => apiFetch("/ml/compare"),
  getABTests: () => apiFetch("/ml/ab-tests"),
  createABTest: (data: { name: string; modelA: string; modelB: string; trafficSplit?: number }) => post("/ml/ab-tests", data),
  deleteABTest: (testId: string) => apiFetch(`/ml/ab-tests/${testId}`, { method: "DELETE" }),

  // Threat Intelligence
  getThreatIOCs: (params?: { type?: string; threat?: string; severity?: string; region?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch(`/threat-intel/iocs${query ? `?${query}` : ""}`);
  },
  reportIOC: (data: { type: string; value: string; threat: string; severity?: string; region?: string }) =>
    post("/threat-intel/iocs", data),
  corroborateIOC: (iocId: string) =>
    post(`/threat-intel/iocs/${iocId}/corroborate`),
  getThreatHeatmap: () => apiFetch("/threat-intel/heatmap"),
  getThreatFeed: (format?: string) =>
    apiFetch(`/threat-intel/feed${format ? `?format=${format}` : ""}`),
  getReputation: (userId: string) =>
    apiFetch(`/threat-intel/reputation/${userId}`),

  // Education
  getTutorials: (params?: { category?: string; difficulty?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiFetch(`/education/tutorials${query ? `?${query}` : ""}`);
  },
  getTutorial: (tutorialId: string) => apiFetch(`/education/tutorials/${tutorialId}`),
  submitQuiz: (tutorialId: string, answers: number[]) => post(`/education/tutorials/${tutorialId}/quiz`, { answers }),
  getCertifications: () => apiFetch("/education/certifications"),
  getEducationProgress: () => apiFetch("/education/progress"),
  getBlogPosts: () => apiFetch("/education/blog"),

  // Health
  getHealth: () => apiFetch("/health"),

  // Feedback
  submitFeedback: (data: { type: string; message: string; page?: string }) =>
    post("/feedback", data),
  submitNps: (score: number, comment?: string) =>
    post("/feedback/nps", { score, comment }),
  getNpsStatus: () => apiFetch("/feedback/nps/status"),
  getFeatureRequests: () => apiFetch("/feedback/features"),
  createFeatureRequest: (title: string, description?: string) =>
    post("/feedback/features", { title, description }),
  voteFeatureRequest: (id: string) => post(`/feedback/features/${id}/vote`),

  // Organizations
  getOrganizations: () => apiFetch("/organizations"),
  createOrganization: (name: string) => post("/organizations", { name }),
  getOrganization: (id: string) => apiFetch(`/organizations/${id}`),
  updateOrganization: (id: string, data: any) =>
    apiFetch(`/organizations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  inviteOrgMember: (orgId: string, email: string, role?: string) =>
    post(`/organizations/${orgId}/invite`, { email, role }),
  acceptOrgInvite: (code: string) => post("/organizations/invite/accept", { code }),
  updateOrgMemberRole: (orgId: string, userId: string, role: string) =>
    apiFetch(`/organizations/${orgId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeOrgMember: (orgId: string, userId: string) =>
    apiFetch(`/organizations/${orgId}/members/${userId}`, { method: "DELETE" }),
  getAuditLogs: (orgId: string, limit?: number) =>
    apiFetch(`/organizations/${orgId}/audit-logs${limit ? `?limit=${limit}` : ""}`),
  configureSso: (orgId: string, data: any) =>
    post(`/organizations/${orgId}/sso`, data),
  disableSso: (orgId: string) =>
    apiFetch(`/organizations/${orgId}/sso`, { method: "DELETE" }),

  // Admin
  request: (path: string, opts?: RequestInit) =>
    apiFetch(path, opts as any),
  getAdminOverview: () => apiFetch("/admin/overview"),
  getAdminRevenue: () => apiFetch("/admin/revenue"),
  getAdminUsers: (limit?: number, offset?: number) =>
    apiFetch(`/admin/users?limit=${limit || 50}&offset=${offset || 0}`),
  getAdminHealth: () => apiFetch("/admin/health"),
  getAdminAlerts: () => apiFetch("/admin/alerts"),
  adminUpdateUserPlan: (userId: string, plan: string) =>
    apiFetch(`/admin/users/${userId}/plan`, { method: "PATCH", body: JSON.stringify({ plan }) }),
  adminUpdateUserRole: (userId: string, role: string) =>
    apiFetch(`/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),

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
