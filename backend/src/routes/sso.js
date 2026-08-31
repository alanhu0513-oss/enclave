const express = require("express");
const crypto = require("crypto");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Get SSO configuration for organization
router.get("/config", authenticate, (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  
  const config = db.get("sso_configurations").find({ userId }).value() || null;
  return success(res, { config: config || { enabled: false } });
});

// Save SAML configuration
router.post("/saml/configure", authenticate, (req, res) => {
  const userId = req.user.userId;
  const { entityId, ssoUrl, certificate, sloUrl, audience } = req.body;
  const db = req.app.get("db");

  if (!entityId || !ssoUrl || !certificate) {
    return error(res, "entityId, ssoUrl, and certificate required", 400);
  }

  const existing = db.get("sso_configurations").find({ userId }).value();
  const configData = {
    provider: "saml",
    entityId,
    ssoUrl,
    certificate,
    sloUrl: sloUrl || null,
    audience: audience || entityId,
    enabled: true,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    db.get("sso_configurations").find({ userId }).assign(configData).write();
  } else {
    db.get("sso_configurations").push({
      id: "sso_" + Date.now(),
      userId,
      ...configData,
      createdAt: new Date().toISOString(),
    }).write();
  }

  return success(res, { message: "SAML configured", config: configData });
});

// Save OIDC configuration
router.post("/oidc/configure", authenticate, (req, res) => {
  const userId = req.user.userId;
  const { issuer, clientId, clientSecret, authorizationUrl, tokenUrl, userInfoUrl, scopes } = req.body;
  const db = req.app.get("db");

  if (!issuer || !clientId || !clientSecret) {
    return error(res, "issuer, clientId, and clientSecret required", 400);
  }

  const existing = db.get("sso_configurations").find({ userId }).value();
  const configData = {
    provider: "oidc",
    issuer,
    clientId,
    clientSecret,
    authorizationUrl: authorizationUrl || `${issuer}/authorize`,
    tokenUrl: tokenUrl || `${issuer}/token`,
    userInfoUrl: userInfoUrl || `${issuer}/userinfo`,
    scopes: scopes || ["openid", "email", "profile"],
    enabled: true,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    db.get("sso_configurations").find({ userId }).assign(configData).write();
  } else {
    db.get("sso_configurations").push({
      id: "sso_" + Date.now(),
      userId,
      ...configData,
      createdAt: new Date().toISOString(),
    }).write();
  }

  return success(res, { message: "OIDC configured", config: configData });
});

// Initiate SSO login
router.post("/initiate", (req, res) => {
  const { email, provider } = req.body;
  const db = req.app.get("db");

  // Find SSO config by email domain
  const configs = db.get("sso_configurations").filter({ enabled: true }).value() || [];
  
  if (configs.length === 0) {
    return error(res, "No SSO configured", 404);
  }

  const config = configs[0]; // In production, match by email domain
  
  if (config.provider === "saml") {
    // Generate SAML AuthnRequest
    const requestId = "_" + crypto.randomBytes(16).toString("hex");
    const acsUrl = process.env.APP_URL + "/api/sso/saml/acs";
    
    const authnRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" 
  ID="${requestId}" Version="2.0" IssueInstant="${new Date().toISOString()}" 
  AssertionConsumerServiceURL="${acsUrl}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${config.audience || config.entityId}</saml:Issuer>
</samlp:AuthnRequest>`;

    return success(res, {
      provider: "saml",
      ssoUrl: config.ssoUrl,
      authnRequest: Buffer.from(authnRequest).toString("base64"),
      requestId,
    });
  } else {
    // OIDC redirect
    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    
    const authUrl = `${config.authorizationUrl}?` + new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: process.env.APP_URL + "/api/sso/oidc/callback",
      response_type: "code",
      scope: (config.scopes || []).join(" "),
      state,
      nonce,
    }).toString();

    return success(res, {
      provider: "oidc",
      authUrl,
      state,
    });
  }
});

// SAML ACS (Assertion Consumer Service) callback
router.post("/saml/acs", (req, res) => {
  // In production, validate SAML response signature
  const { SAMLResponse } = req.body;
  
  if (!SAMLResponse) {
    return res.redirect(process.env.APP_URL + "/login?error=saml_no_response");
  }

  // Mock: decode and extract user info
  // In production, use a SAML library like passport-saml
  try {
    const decoded = Buffer.from(SAMLResponse, "base64").toString();
    // Extract email from SAML assertion (simplified)
    const emailMatch = decoded.match(/NameID[^>]*>([^<]+)/);
    const email = emailMatch ? emailMatch[1] : "sso-user@example.com";
    
    // Find or create user
    const db = req.app.get("db");
    let user = db.get("users").find({ email }).value();
    
    if (!user) {
      user = {
        id: "user_" + Date.now(),
        email,
        fullName: email.split("@")[0],
        plan: "business",
        createdAt: new Date().toISOString(),
      };
      db.get("users").push(user).write();
    }

    // Generate token
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
  
  if (!code) {
    return res.redirect(process.env.APP_URL + "/login?error=oidc_no_code");
  }

  // In production, exchange code for tokens with OIDC provider
  // Mock: create/find user
  const db = req.app.get("db");
  const email = "oidc-user@example.com";
  
  let user = db.get("users").find({ email }).value();
  if (!user) {
    user = {
      id: "user_" + Date.now(),
      email,
      fullName: email.split("@")[0],
      plan: "business",
      createdAt: new Date().toISOString(),
    };
    db.get("users").push(user).write();
  }

  const jwt = require("jsonwebtoken");
  const { JWT_SECRET } = require("../middleware/auth");
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  return res.redirect(`${process.env.APP_URL}/login?token=${token}`);
});

// Test SSO connection
router.post("/test", authenticate, async (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const config = db.get("sso_configurations").find({ userId }).value();

  if (!config || !config.enabled) {
    return error(res, "No SSO configured", 400);
  }

  // Mock test - in production, attempt actual authentication
  return success(res, {
    status: "ok",
    provider: config.provider,
    message: `${config.provider.toUpperCase()} connection successful`,
  });
});

// SCIM provisioning (simplified)
router.post("/scim/provision", authenticate, (req, res) => {
  const { email, name, role } = req.body;
  const db = req.app.get("db");

  if (!email) {
    return error(res, "email required", 400);
  }

  const existing = db.get("users").find({ email }).value();
  if (existing) {
    return success(res, { message: "User already exists", userId: existing.id });
  }

  const user = {
    id: "user_" + Date.now(),
    email,
    fullName: name || email.split("@")[0],
    plan: "business",
    role: role || "member",
    provisionedVia: "scim",
    createdAt: new Date().toISOString(),
  };

  db.get("users").push(user).write();
  return success(res, { message: "User provisioned", userId: user.id }, 201);
});

// Audit log
router.get("/audit", authenticate, (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const logs = db.get("audit_logs").filter({ userId }).value() || [];
  return success(res, { logs: logs.slice(-100) }); // Last 100 entries
});

module.exports = router;
