const express = require("express");
const crypto = require("crypto");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

function generateApiKey() {
  const prefix = "env_";
  const key = crypto.randomBytes(32).toString("hex");
  return prefix + key;
}

// List API keys
router.get("/keys", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const keys = db.get("api_keys").filter({ userId }).value() || [];

  const masked = keys.map(k => ({
    ...k,
    keyPreview: k.key.slice(0, 8) + "..." + k.key.slice(-4),
    key: undefined,
  }));

  return success(res, { keys: masked });
});

// Create API key
router.post("/keys", (req, res) => {
  const userId = req.user.userId;
  const { name, permissions, rateLimit } = req.body;
  const db = req.app.get("db");

  if (!name) {
    return error(res, "Key name required", 400);
  }

  const key = generateApiKey();
  const apiKey = {
    id: "key_" + Date.now(),
    userId,
    name,
    key,
    permissions: permissions || ["read"],
    rateLimit: rateLimit || 100,
    totalRequests: 0,
    lastUsedAt: null,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  db.get("api_keys").push(apiKey).write();

  db.get("audit_logs").push({
    id: "audit_" + Date.now(),
    userId,
    action: "api_key_created",
    detail: `Created key: ${name}`,
    timestamp: new Date().toISOString(),
  }).write();

  return success(res, { message: "API key created", key: apiKey }, 201);
});

// Revoke API key
router.delete("/keys/:keyId", (req, res) => {
  const userId = req.user.userId;
  const { keyId } = req.params;
  const db = req.app.get("db");

  const key = db.get("api_keys").find({ id: keyId, userId }).value();
  if (!key) {
    return error(res, "Key not found", 404);
  }

  db.get("api_keys").find({ id: keyId }).assign({ status: "revoked" }).write();

  db.get("audit_logs").push({
    id: "audit_" + Date.now(),
    userId,
    action: "api_key_revoked",
    detail: `Revoked key: ${key.name}`,
    timestamp: new Date().toISOString(),
  }).write();

  return success(res, { message: "API key revoked" });
});

// Get usage analytics
router.get("/usage", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");

  const keys = db.get("api_keys").filter({ userId }).value() || [];
  const logs = db.get("api_usage_logs").filter({ userId }).value() || [];

  const totalRequests = keys.reduce((sum, k) => sum + (k.totalRequests || 0), 0);
  const activeKeys = keys.filter(k => k.status === "active").length;

  const now = Date.now();
  const dailyUsage = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const dayLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith(dateStr));
    dailyUsage.push({
      date: dateStr,
      requests: dayLogs.length,
    });
  }

  const endpointUsage = {};
  for (const log of logs) {
    const endpoint = log.endpoint || "unknown";
    endpointUsage[endpoint] = (endpointUsage[endpoint] || 0) + 1;
  }

  return success(res, {
    summary: {
      totalRequests,
      activeKeys,
      totalKeys: keys.length,
      avgRequestsPerDay: Math.round(totalRequests / 7),
    },
    dailyUsage,
    endpointUsage: Object.entries(endpointUsage)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  });
});

// Webhooks
router.get("/webhooks", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const webhooks = db.get("webhooks").filter({ userId }).value() || [];
  return success(res, { webhooks });
});

router.post("/webhooks", (req, res) => {
  const userId = req.user.userId;
  const { url, events, secret } = req.body;
  const db = req.app.get("db");

  if (!url || !events || !Array.isArray(events)) {
    return error(res, "url and events array required", 400);
  }

  const webhook = {
    id: "wh_" + Date.now(),
    userId,
    url,
    events,
    secret: secret || crypto.randomBytes(24).toString("hex"),
    status: "active",
    lastTriggeredAt: null,
    failureCount: 0,
    createdAt: new Date().toISOString(),
  };

  db.get("webhooks").push(webhook).write();
  return success(res, { message: "Webhook created", webhook }, 201);
});

router.delete("/webhooks/:webhookId", (req, res) => {
  const userId = req.user.userId;
  const { webhookId } = req.params;
  const db = req.app.get("db");

  const webhook = db.get("webhooks").find({ id: webhookId, userId }).value();
  if (!webhook) {
    return error(res, "Webhook not found", 404);
  }

  db.get("webhooks").remove({ id: webhookId }).write();
  return success(res, { message: "Webhook deleted" });
});

router.post("/webhooks/:webhookId/test", (req, res) => {
  const userId = req.user.userId;
  const { webhookId } = req.params;
  const db = req.app.get("db");

  const webhook = db.get("webhooks").find({ id: webhookId, userId }).value();
  if (!webhook) {
    return error(res, "Webhook not found", 404);
  }

  db.get("webhooks").find({ id: webhookId }).assign({
    lastTriggeredAt: new Date().toISOString(),
  }).write();

  return success(res, { message: "Test webhook sent" });
});

// Rate limit dashboard
router.get("/rate-limits", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const keys = db.get("api_keys").filter({ userId }).value() || [];

  const limits = keys.map(k => ({
    keyId: k.id,
    name: k.name,
    rateLimit: k.rateLimit || 100,
    currentUsage: 0,
    status: "ok",
  }));

  return success(res, { limits });
});

module.exports = router;
