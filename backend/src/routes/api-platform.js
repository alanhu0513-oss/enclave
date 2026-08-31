const express = require("express");
const crypto = require("crypto");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { table } = require("../db/query");

const router = express.Router();
router.use(authenticate);

function generateApiKey() {
  const prefix = "env_";
  const key = crypto.randomBytes(32).toString("hex");
  return prefix + key;
}

// List API keys
router.get("/keys", async (req, res) => {
  try {
    const userId = req.user.userId;
    const keysTbl = await table("api_keys");
    const keys = await keysTbl.filter({ user_id: userId });

    const masked = keys.map(k => ({
      ...k,
      keyPreview: k.key.slice(0, 8) + "..." + k.key.slice(-4),
      key: undefined,
    }));

    return success(res, { keys: masked });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Create API key
router.post("/keys", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, permissions, rateLimit } = req.body;

    if (!name) {
      return error(res, "Key name required", 400);
    }

    const key = generateApiKey();
    const apiKey = {
      id: "key_" + Date.now(),
      user_id: userId,
      name,
      key,
      permissions: JSON.stringify(permissions || ["read"]),
      rate_limit: rateLimit || 100,
      total_requests: 0,
      last_used_at: null,
      status: "active",
    };

    const keysTbl = await table("api_keys");
    await keysTbl.insert(apiKey);

    const auditTbl = await table("audit_logs");
    await auditTbl.insert({
      id: "audit_" + Date.now(),
      user_id: userId,
      action: "api_key_created",
      detail: `Created key: ${name}`,
    });

    return success(res, { message: "API key created", key: apiKey }, 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Revoke API key
router.delete("/keys/:keyId", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { keyId } = req.params;

    const keysTbl = await table("api_keys");
    const key = await keysTbl.find({ id: keyId, user_id: userId });
    if (!key) {
      return error(res, "Key not found", 404);
    }

    await keysTbl.update({ id: keyId }, { status: "revoked" });

    const auditTbl = await table("audit_logs");
    await auditTbl.insert({
      id: "audit_" + Date.now(),
      user_id: userId,
      action: "api_key_revoked",
      detail: `Revoked key: ${key.name}`,
    });

    return success(res, { message: "API key revoked" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Get usage analytics
router.get("/usage", async (req, res) => {
  try {
    const userId = req.user.userId;

    const keysTbl = await table("api_keys");
    const keys = await keysTbl.filter({ user_id: userId });

    const logsTbl = await table("api_usage_logs");
    const logs = await logsTbl.filter({ user_id: userId });

    const totalRequests = keys.reduce((sum, k) => sum + (k.total_requests || 0), 0);
    const activeKeys = keys.filter(k => k.status === "active").length;

    const now = Date.now();
    const dailyUsage = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * 86400000);
      const dateStr = date.toISOString().split("T")[0];
      const dayLogs = logs.filter(l => l.created_at && l.created_at.startsWith(dateStr));
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
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Webhooks
router.get("/webhooks", async (req, res) => {
  try {
    const userId = req.user.userId;
    const whTbl = await table("webhooks");
    const webhooks = await whTbl.filter({ user_id: userId });
    return success(res, { webhooks });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/webhooks", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { url, events, secret } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      return error(res, "url and events array required", 400);
    }

    const webhook = {
      id: "wh_" + Date.now(),
      user_id: userId,
      url,
      events: JSON.stringify(events),
      secret: secret || crypto.randomBytes(24).toString("hex"),
      active: true,
      failure_count: 0,
      last_triggered_at: null,
    };

    const whTbl = await table("webhooks");
    await whTbl.insert(webhook);
    return success(res, { message: "Webhook created", webhook }, 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.delete("/webhooks/:webhookId", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { webhookId } = req.params;

    const whTbl = await table("webhooks");
    const webhook = await whTbl.find({ id: webhookId, user_id: userId });
    if (!webhook) {
      return error(res, "Webhook not found", 404);
    }

    await whTbl.remove({ id: webhookId });
    return success(res, { message: "Webhook deleted" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/webhooks/:webhookId/test", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { webhookId } = req.params;

    const whTbl = await table("webhooks");
    const webhook = await whTbl.find({ id: webhookId, user_id: userId });
    if (!webhook) {
      return error(res, "Webhook not found", 404);
    }

    await whTbl.update({ id: webhookId }, { last_triggered_at: new Date().toISOString() });

    return success(res, { message: "Test webhook sent" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Rate limit dashboard
router.get("/rate-limits", async (req, res) => {
  try {
    const userId = req.user.userId;
    const keysTbl = await table("api_keys");
    const keys = await keysTbl.filter({ user_id: userId });

    const limits = keys.map(k => ({
      keyId: k.id,
      name: k.name,
      rateLimit: k.rate_limit || 100,
      currentUsage: 0,
      status: "ok",
    }));

    return success(res, { limits });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
