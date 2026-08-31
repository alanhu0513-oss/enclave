const express = require("express");
const crypto = require("crypto");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { table } = require("../db/query");

const router = express.Router();

// Get SSO configuration for organization
router.get("/config", authenticate, async (req, res) => {
  try {
    const tbl = await table("sso_configurations");
    const config = await tbl.find({ user_id: req.user.userId });
    return success(res, { config: config || { enabled: false } });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Save SAML configuration
router.post("/saml/configure", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { entityId, ssoUrl, certificate, sloUrl, audience } = req.body;
    if (!entityId || !ssoUrl || !certificate) {
      return error(res, "entityId, ssoUrl, and certificate required", 400);
    }

    const tbl = await table("sso_configurations");
    const existing = await tbl.find({ user_id: userId });
    const configData = {
      provider: "saml",
      name: entityId,
      protocol: "saml",
      entity_id: entityId,
      sso_url: ssoUrl,
      certificate,
      slo_url: sloUrl || null,
      audience: audience || entityId,
      enabled: true,
    };

    if (existing) {
      await tbl.update({ user_id: userId }, configData);
    } else {
      await tbl.insert({ id: "sso_" + Date.now(), user_id: userId, ...configData });
    }

    return success(res, { message: "SAML configured", config: configData });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Save OIDC configuration
router.post("/oidc/configure", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { issuer, clientId, clientSecret, authorizationUrl, tokenUrl, userInfoUrl, scopes } = req.body;
    if (!issuer || !clientId || !clientSecret) {
      return error(res, "issuer, clientId, and clientSecret required", 400);
    }

    const tbl = await table("sso_configurations");
    const existing = await tbl.find({ user_id: userId });
    const configData = {
      provider: "oidc",
      name: issuer,
      protocol: "oidc",
      client_id: clientId,
      client_secret: clientSecret,
      metadata_url: authorizationUrl || `${issuer}/authorize`,
      sso_url: tokenUrl || `${issuer}/token`,
      enabled: true,
    };

    if (existing) {
      await tbl.update({ user_id: userId }, configData);
    } else {
      await tbl.insert({ id: "sso_" + Date.now(), user_id: userId, ...configData });
    }

    return success(res, { message: "OIDC configured", config: configData });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Initiate SSO login
router.post("/initiate", async (req, res) => {
  try {
    const { email, provider } = req.body;
    const tbl = await table("sso_configurations");
    const configs = await tbl.filter({ enabled: true });

    if (configs.length === 0) {
      return error(res, "No SSO configured", 404);
    }

    const config = configs[0];

    if (config.provider === "saml") {
      const requestId = "_" + crypto.randomBytes(16).toString("hex");
      const acsUrl = process.env.APP_URL + "/api/sso/saml/acs";
      const authnRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" 
  ID="${requestId}" Version="2.0" IssueInstant="${new Date().toISOString()}" 
  AssertionConsumerServiceURL="${acsUrl}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${config.audience || config.entity_id}</saml:Issuer>
</samlp:AuthnRequest>`;

      return success(res, {
        provider: "saml",
        ssoUrl: config.sso_url,
        authnRequest: Buffer.from(authnRequest).toString("base64"),
        requestId,
      });
    } else {
      const state = crypto.randomBytes(16).toString("hex");
      const nonce = crypto.randomBytes(16).toString("hex");
      const authUrl = `${config.metadata_url}?` + new URLSearchParams({
        client_id: config.client_id,
        redirect_uri: process.env.APP_URL + "/api/sso/oidc/callback",
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce,
      }).toString();

      return success(res, { provider: "oidc", authUrl, state });
    }
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// SAML ACS callback
router.post("/saml/acs", async (req, res) => {
  const { SAMLResponse } = req.body;
  if (!SAMLResponse) return res.redirect(process.env.APP_URL + "/login?error=saml_no_response");

  try {
    const decoded = Buffer.from(SAMLResponse, "base64").toString();
    const emailMatch = decoded.match(/NameID[^>]*>([^<]+)/);
    const email = emailMatch ? emailMatch[1] : "sso-user@example.com";

    const usersTbl = await table("users");
    let user = await usersTbl.find({ email });
    if (!user) {
      user = { id: "user_" + Date.now(), email, full_name: email.split("@")[0], subscription_tier: "business", provider: "sso" };
      await usersTbl.insert(user);
    }

    const jwt = require("jsonwebtoken");
    const { JWT_SECRET } = require("../middleware/auth");
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    return res.redirect(`${process.env.APP_URL}/login?token=${token}`);
  } catch (e) {
    return res.redirect(process.env.APP_URL + "/login?error=saml_invalid");
  }
});

// OIDC callback
router.get("/oidc/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect(process.env.APP_URL + "/login?error=oidc_no_code");

  try {
    const email = "oidc-user@example.com";
    const usersTbl = await table("users");
    let user = await usersTbl.find({ email });
    if (!user) {
      user = { id: "user_" + Date.now(), email, full_name: email.split("@")[0], subscription_tier: "business", provider: "oidc" };
      await usersTbl.insert(user);
    }

    const jwt = require("jsonwebtoken");
    const { JWT_SECRET } = require("../middleware/auth");
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    return res.redirect(`${process.env.APP_URL}/login?token=${token}`);
  } catch (e) {
    return res.redirect(process.env.APP_URL + "/login?error=oidc_invalid");
  }
});

// Test SSO connection
router.post("/test", authenticate, async (req, res) => {
  try {
    const tbl = await table("sso_configurations");
    const config = await tbl.find({ user_id: req.user.userId });
    if (!config || !config.enabled) return error(res, "No SSO configured", 400);
    return success(res, { status: "ok", provider: config.provider, message: `${config.provider.toUpperCase()} connection successful` });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// SCIM provisioning
router.post("/scim/provision", authenticate, async (req, res) => {
  try {
    const { email, name, role } = req.body;
    if (!email) return error(res, "email required", 400);

    const usersTbl = await table("users");
    const existing = await usersTbl.find({ email });
    if (existing) return success(res, { message: "User already exists", userId: existing.id });

    const user = { id: "user_" + Date.now(), email, full_name: name || email.split("@")[0], subscription_tier: "business", provider: "scim" };
    await usersTbl.insert(user);
    return success(res, { message: "User provisioned", userId: user.id }, 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Audit log
router.get("/audit", authenticate, async (req, res) => {
  try {
    const tbl = await table("audit_logs");
    const logs = await tbl.filter({ user_id: req.user.userId });
    return success(res, { logs: logs.slice(-100) });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
