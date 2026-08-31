const fetch = require("node-fetch");
const FormData = require("form-data");
const fs = require("fs");

class EnclaveClient {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || process.env.ENCLAVE_API_URL || "https://enclave-production-d818.up.railway.app";
    this.apiKey = options.apiKey || process.env.ENCLAVE_API_KEY || "";
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  // Scan
  async scanFile(filePath, type = "image") {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    formData.append("type", type);

    return this.request("/api/scan/file", {
      method: "POST",
      headers: formData.getHeaders(),
      body: formData,
    });
  }

  async scanUrl(url, type = "image") {
    return this.request("/api/scan", {
      method: "POST",
      body: JSON.stringify({ url, type }),
    });
  }

  // Shields
  async getShields() {
    return this.request("/api/shields");
  }

  async toggleShield(shieldId, enabled) {
    return this.request(`/api/shields/${shieldId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
  }

  // Alerts
  async getAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/alerts${query ? `?${query}` : ""}`);
  }

  async getAlert(alertId) {
    return this.request(`/api/alerts/${alertId}`);
  }

  // Takedowns
  async createTakedown(data) {
    return this.request("/api/takedowns", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTakedowns() {
    return this.request("/api/takedowns");
  }

  // Insurance
  async getInsurancePlans() {
    return this.request("/api/insurance/plans");
  }

  async subscribeInsurance(planId) {
    return this.request("/api/insurance/subscribe", {
      method: "POST",
      body: JSON.stringify({ planId }),
    });
  }

  // Passport
  async enrollPassport(data) {
    return this.request("/api/passport/enroll", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async verifyPassport(passportId) {
    return this.request(`/api/passport/${passportId}/verify`);
  }

  // Health
  async health() {
    return this.request("/api/health");
  }
}

module.exports = { EnclaveClient };
