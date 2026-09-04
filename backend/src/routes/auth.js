const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');
const { generateTokenForUser, authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const notify = require('../services/notifications');

let OAuth2Client = null;
try {
  const { OAuth2Client: O2C } = require('google-auth-library');
  OAuth2Client = O2C;
} catch (e) {
  console.warn('[AUTH] google-auth-library not installed — Google Sign-In disabled');
}

const router = express.Router();
const passwordResetCodes = new Map();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePasswordComplexity(pw) {
  if (pw.length < 8 || pw.length > 128) return 'Password must be 8–128 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  return null;
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               fullName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already registered
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) return error(res, 'Email, password, and full name required', 400);
    if (!EMAIL_RE.test(email)) return error(res, 'Invalid email format', 400);
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return error(res, 'Password must be 8–128 characters', 400);
    }
    const pwError = validatePasswordComplexity(password);
    if (pwError) return error(res, pwError, 400);
    if (typeof fullName !== 'string' || fullName.trim().length < 1 || fullName.length > 100) {
      return error(res, 'Full name must be 1–100 characters', 400);
    }

    const users = await table('users');
    const existing = await users.find({ email: email.toLowerCase() });
    if (existing) return error(res, 'Email already registered', 409);

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const now = new Date().toISOString();
    const userRow = await users.insert({
      id, email: email.toLowerCase(), password_hash: hash,
      full_name: fullName, token_version: 0, created_at: now, updated_at: now
    });
    const token = await generateTokenForUser({ id, email });
    return success(res, { token, user: { id, email, fullName, emailVerified: false } }, 'Account created', 201);
  } catch (e) {
    console.error('[AUTH] Register error:', e);
    return error(res, e.message || 'Registration failed');
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);
    if (!EMAIL_RE.test(email)) return error(res, 'Invalid email format', 400);

    const users = await table('users');
    const user = await users.find({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return error(res, 'Invalid email or password', 401);
    }

    const attempts = await table('auth_attempts');
    await attempts.insert({
      id: uuidv4(), user_id: user.id, succeeded: 1,
      ip_address: req.ip, attempted_at: new Date().toISOString()
    });

    const token = await generateTokenForUser(user);
    return success(res, { token, user: { id: user.id, email: user.email, fullName: user.full_name } }, 'Login successful');
  } catch (e) {
    console.error('[AUTH] Login error:', e);
    return error(res, e.message || 'Login failed');
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return error(res, 'Email is required', 400);

    const users = await table('users');
    const user = await users.find({ email: email.toLowerCase() });

    if (!user) {
      return success(res, null, 'If that email is registered, a reset code has been sent.');
    }

    const code = String(crypto.randomInt(10000000, 99999999));
    const expires = Date.now() + 15 * 60 * 1000;
    passwordResetCodes.set(email.toLowerCase(), { code, expires, userId: user.id });

    // Send reset code via email
    const resetHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#050507;">Enclave — Password Reset</h2>
        <p>You requested a password reset. Your verification code:</p>
        <div style="background:#050507;color:#00ff88;font-family:monospace;font-size:32px;padding:16px;border-radius:8px;text-align:center;letter-spacing:4px;margin:16px 0;">${code}</div>
        <p style="color:#666;font-size:14px;">This code expires in 15 minutes. If you didn't request this, please ignore.</p>
      </div>
    `;
    await notify.sendEmail(email, 'Enclave Password Reset Code', resetHtml);

    return success(res, null, 'If that email is registered, a reset code has been sent.');
  } catch (e) {
    console.error('[AUTH] Forgot password error:', e);
    return error(res, e.message || 'Forgot password failed');
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return error(res, 'Email, code, and new password required', 400);
    if (newPassword.length < 8) return error(res, 'Password must be at least 8 characters', 400);
    const pwErr1 = validatePasswordComplexity(newPassword);
    if (pwErr1) return error(res, pwErr1, 400);

    const key = email.toLowerCase();
    const stored = passwordResetCodes.get(key);
    if (!stored) return error(res, 'No reset request found. Request a new code.', 400);
    if (Date.now() > stored.expires) {
      passwordResetCodes.delete(key);
      return error(res, 'Reset code expired. Request a new code.', 400);
    }
    if (stored.code !== code) return error(res, 'Invalid reset code', 400);

    const users = await table('users');
    const hash = await bcrypt.hash(newPassword, 12);
    await users.update({ id: stored.userId }, { password_hash: hash, updated_at: new Date().toISOString() });
    passwordResetCodes.delete(key);

    return success(res, null, 'Password reset successfully');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return error(res, 'Google credential required', 400);
    if (!OAuth2Client) return error(res, 'Google Auth library not installed', 500);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return error(res, 'Google Sign-In not configured', 500);
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    const users = await table('users');
    let user = await users.find({ email: email.toLowerCase() });

    if (!user) {
      const id = uuidv4();
      const now = new Date().toISOString();
      await users.insert({
        id, email: email.toLowerCase(), password_hash: null,
        full_name: name || email.split('@')[0],
        provider: 'google', provider_id: googleId,
        avatar_url: picture || null,
        created_at: now, updated_at: now
      });
      user = { id, email: email.toLowerCase(), full_name: name || email.split('@')[0] };
    } else if (!user.provider_id) {
      await users.update({ id: user.id }, {
        provider: 'google', provider_id: googleId,
        avatar_url: picture || user.avatar_url,
        updated_at: new Date().toISOString()
      });
    }

    const token = await generateTokenForUser(user);
    return success(res, { token, user: { id: user.id, email: user.email, fullName: user.full_name } }, 'Google sign-in successful');
  } catch (e) {
    console.error('[AUTH] Google sign-in error:', e.message);
    return error(res, 'Invalid Google credential', 401);
  }
});

// ─── Vault lock: verify account password before unlocking the screen ───
router.post('/verify-password', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return error(res, 'Password is required', 400);

    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user || !user.password_hash) {
      return error(res, 'Account has no password set', 400);
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return error(res, 'Incorrect password', 401);
    }
    return success(res, { verified: true }, 'Password verified');
  } catch (e) {
    return error(res, e.message || 'Verification failed');
  }
});

// ─── Logout: revoke all outstanding tokens for this account ───
router.post('/logout', authenticate, async (req, res) => {
  try {
    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (user) {
      await users.update({ id: user.id }, {
        token_version: (user.token_version ?? user.version ?? 0) + 1,
        updated_at: new Date().toISOString()
      });
    }
    return success(res, null, 'Logged out');
  } catch (e) {
    return error(res, e.message || 'Logout failed');
  }
});

// ─── Change password (authenticated) with full session revocation ───
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return error(res, 'Current and new password required', 400);
    if (newPassword.length < 8) return error(res, 'Password must be at least 8 characters', 400);
    const pwErr2 = validatePasswordComplexity(newPassword);
    if (pwErr2) return error(res, pwErr2, 400);

    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user || !user.password_hash) return error(res, 'Account has no password set', 400);
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return error(res, 'Current password is incorrect', 401);
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await users.update({ id: user.id }, {
      password_hash: hash,
      token_version: (user.token_version ?? user.version ?? 0) + 1,
      updated_at: new Date().toISOString()
    });
    const token = await generateTokenForUser({ id: user.id, email: user.email });
    return success(res, { token, user: { id: user.id, email: user.email, fullName: user.full_name, emailVerified: !!user.email_verified } }, 'Password changed');
  } catch (e) {
    return error(res, e.message || 'Change password failed');
  }
});

// ─── 2FA (TOTP) ───
let speakeasy, qrcode;
try { speakeasy = require('speakeasy'); qrcode = require('qrcode'); } catch (_) {}

// Get 2FA status
router.get('/2fa/status', authenticate, async (req, res) => {
  try {
    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user) return error(res, 'User not found', 404);
    return success(res, { enabled: !!user.totp_enabled, hasSecret: !!user.totp_secret });
  } catch (e) {
    return error(res, e.message || 'Failed to get 2FA status');
  }
});

router.post('/2fa/setup', authenticate, async (req, res) => {  try {
    if (!speakeasy) return error(res, '2FA module not installed', 500);
    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user) return error(res, 'User not found', 404);

    const secret = speakeasy.generateSecret({ name: `Enclave (${user.email})`, length: 20 });
    await users.update({ id: user.id }, {
      totp_secret: secret.base32,
      totp_enabled: false,
      updated_at: new Date().toISOString(),
    });

    const otpauthUrl = secret.otpauth_url;
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    return success(res, {
      secret: secret.base32,
      qrCode: qrDataUrl,
      message: 'Scan QR code with authenticator app, then verify with /api/auth/2fa/verify',
    });
  } catch (e) {
    return error(res, e.message || '2FA setup failed');
  }
});

router.post('/2fa/verify', authenticate, async (req, res) => {
  try {
    if (!speakeasy) return error(res, '2FA module not installed', 500);
    const { token } = req.body;
    if (!token) return error(res, 'Token required', 400);

    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user || !user.totp_secret) return error(res, '2FA not set up', 400);

    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) return error(res, 'Invalid token', 400);

    await users.update({ id: user.id }, {
      totp_enabled: true,
      updated_at: new Date().toISOString(),
    });

    return success(res, { message: '2FA enabled successfully' });
  } catch (e) {
    return error(res, e.message || '2FA verification failed');
  }
});

router.post('/2fa/disable', authenticate, async (req, res) => {
  try {
    if (!speakeasy) return error(res, '2FA module not installed', 500);
    const { token, password } = req.body;
    if (!token || !password) return error(res, 'Token and password required', 400);

    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user) return error(res, 'User not found', 404);

    if (!(await bcrypt.compare(password, user.password_hash))) {
      return error(res, 'Incorrect password', 401);
    }

    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!verified) return error(res, 'Invalid token', 400);

    await users.update({ id: user.id }, {
      totp_secret: null,
      totp_enabled: false,
      updated_at: new Date().toISOString(),
    });

    return success(res, { message: '2FA disabled' });
  } catch (e) {
    return error(res, e.message || '2FA disable failed');
  }
});

// Login with 2FA check
router.post('/login', async (req, res) => {
  try {
    const { email, password, totpToken } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

    const users = await table('users');
    const user = await users.find({ email: email.toLowerCase() });
    if (!user) return error(res, 'Invalid credentials', 401);

    if (!(await bcrypt.compare(password, user.password_hash))) {
      return error(res, 'Invalid credentials', 401);
    }

    // Check 2FA
    if (user.totp_enabled && user.totp_secret) {
      if (!totpToken) return error(res, '2FA token required', 403, { requires2FA: true });

      const verified = speakeasy?.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: totpToken,
        window: 1,
      });
      if (!verified) return error(res, 'Invalid 2FA token', 401);
    }

    // Log login history
    try {
      const loginHistory = await table('login_history');
      await loginHistory.create({
        user_id: user.id,
        ip_address: req.ip || req.connection?.remoteAddress || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        success: true,
        created_at: new Date().toISOString(),
      });
    } catch (_) {}

    const token = await generateTokenForUser({ id: user.id, email: user.email });
    return success(res, {
      token,
      user: { id: user.id, email: user.email, fullName: user.full_name, emailVerified: !!user.email_verified, plan: user.subscription_tier },
    });
  } catch (e) {
    return error(res, e.message || 'Login failed');
  }
});

// ─── Email Verification ───
const verificationCodes = new Map(); // key: email+purpose, value: { code, expires, userId }

// Send verification code (authenticated)
router.post('/send-verification', authenticate, async (req, res) => {
  try {
    const { purpose = 'general' } = req.body; // general, change-password, delete-account, change-email
    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user) return error(res, 'User not found', 404);

    const code = String(crypto.randomInt(100000, 999999));
    const key = `${user.email}:${purpose}`;
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
    verificationCodes.set(key, { code, expires, userId: user.id });

    const purposeLabels = {
      general: 'account verification',
      'change-password': 'password change',
      'delete-account': 'account deletion',
      'change-email': 'email change',
    };
    const label = purposeLabels[purpose] || 'verification';

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:linear-gradient(135deg,#111113,#18181b);border-radius:16px;padding:32px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">&#128737;</div>
          <h2 style="color:#fafaf9;font-size:24px;margin:0 0 8px;">Enclave</h2>
          <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">Your ${label} code</p>
          <div style="background:#050507;color:#34d399;font-family:monospace;font-size:36px;padding:20px;border-radius:12px;letter-spacing:8px;margin:0 0 24px;">${code}</div>
          <p style="color:#71717a;font-size:13px;margin:0;">This code expires in 10 minutes.</p>
          <p style="color:#71717a;font-size:13px;margin:8px 0 0;">If you didn't request this, ignore this email.</p>
        </div>
      </div>
    `;

    const result = await notify.sendEmail(user.email, `Enclave — ${label.charAt(0).toUpperCase() + label.slice(1)} Code`, html);
    if (!result.sent) {
      // SMTP not configured — log code for dev/testing
      console.warn(`[AUTH] SMTP not configured — ${purpose} code for ${user.email}: ${code}`);
      return success(res, { sent: true, debugCode: code }, `Verification code generated for ${user.email} (email not sent — SMTP not configured)`);
    }
    return success(res, { sent: true }, `Verification code sent to ${user.email}`);
  } catch (e) {
    return error(res, e.message || 'Failed to send verification code');
  }
});

// Verify email code (authenticated)
router.post('/verify-email', authenticate, async (req, res) => {
  try {
    const { code, purpose = 'general' } = req.body;
    if (!code) return error(res, 'Verification code is required', 400);

    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user) return error(res, 'User not found', 404);

    const key = `${user.email}:${purpose}`;
    const stored = verificationCodes.get(key);
    if (!stored) return error(res, 'No verification request found. Request a new code.', 400);
    if (Date.now() > stored.expires) {
      verificationCodes.delete(key);
      return error(res, 'Verification code expired. Request a new code.', 400);
    }
    if (stored.code !== code) return error(res, 'Invalid verification code', 400);

    // Mark email as verified if this was general verification
    if (purpose === 'general') {
      await users.update({ id: user.id }, { email_verified: true, updated_at: new Date().toISOString() });
    }

    verificationCodes.delete(key);
    return success(res, { verified: true }, 'Email verified successfully');
  } catch (e) {
    return error(res, e.message || 'Verification failed');
  }
});

// Change email (authenticated, requires verification of current email)
router.post('/change-email', authenticate, async (req, res) => {
  try {
    const { newEmail, code } = req.body;
    if (!newEmail || !code) return error(res, 'New email and verification code required', 400);
    if (!EMAIL_RE.test(newEmail)) return error(res, 'Invalid email format', 400);

    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user) return error(res, 'User not found', 404);

    // Verify current email code
    const key = `${user.email}:change-email`;
    const stored = verificationCodes.get(key);
    if (!stored) return error(res, 'No verification request found', 400);
    if (Date.now() > stored.expires) {
      verificationCodes.delete(key);
      return error(res, 'Verification code expired', 400);
    }
    if (stored.code !== code) return error(res, 'Invalid verification code', 400);

    // Check if new email is already taken
    const existing = await users.find({ email: newEmail.toLowerCase() });
    if (existing && existing.id !== user.id) {
      return error(res, 'Email already in use', 400);
    }

    await users.update({ id: user.id }, {
      email: newEmail.toLowerCase(),
      email_verified: false,
      updated_at: new Date().toISOString(),
    });

    verificationCodes.delete(key);

    // Send verification to new email
    const verifyCode = String(crypto.randomInt(100000, 999999));
    const verifyKey = `${newEmail.toLowerCase()}:general`;
    verificationCodes.set(verifyKey, { code: verifyCode, expires: Date.now() + 10 * 60 * 1000, userId: user.id });

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:linear-gradient(135deg,#111113,#18181b);border-radius:16px;padding:32px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">&#128233;</div>
          <h2 style="color:#fafaf9;font-size:24px;margin:0 0 8px;">Email Changed</h2>
          <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">Verify your new email address</p>
          <div style="background:#050507;color:#34d399;font-family:monospace;font-size:36px;padding:20px;border-radius:12px;letter-spacing:8px;margin:0 0 24px;">${verifyCode}</div>
          <p style="color:#71717a;font-size:13px;margin:0;">This code expires in 10 minutes.</p>
        </div>
      </div>
    `;
    await notify.sendEmail(newEmail, 'Enclave — Verify Your New Email', html);

    return success(res, { changed: true }, 'Email changed. Verification sent to new email.');
  } catch (e) {
    return error(res, e.message || 'Failed to change email');
  }
});

// Delete account (authenticated, requires password + verification code)
router.post('/delete-account', authenticate, async (req, res) => {
  try {
    const { password, code } = req.body;
    if (!password || !code) return error(res, 'Password and verification code required', 400);

    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user) return error(res, 'User not found', 404);
    if (!user.password_hash) return error(res, 'Account has no password set', 400);
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return error(res, 'Incorrect password', 401);
    }

    // Verify code
    const key = `${user.email}:delete-account`;
    const stored = verificationCodes.get(key);
    if (!stored) return error(res, 'No verification request found', 400);
    if (Date.now() > stored.expires) {
      verificationCodes.delete(key);
      return error(res, 'Verification code expired', 400);
    }
    if (stored.code !== code) return error(res, 'Invalid verification code', 400);

    // Soft delete - mark as deleted, keep data for 30 days
    await users.update({ id: user.id }, {
      deleted: true,
      deleted_at: new Date().toISOString(),
      token_version: (user.token_version ?? user.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
    });

    verificationCodes.delete(key);
    return success(res, null, 'Account deleted. Data will be purged after 30 days.');
  } catch (e) {
    return error(res, e.message || 'Failed to delete account');
  }
});

// Get login history (authenticated)
router.get('/login-history', authenticate, async (req, res) => {
  try {
    const loginHistory = await table('login_history');
    const logs = await loginHistory.filter({ user_id: req.user.userId });
    const sorted = Array.isArray(logs)
      ? logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20)
      : [];
    return success(res, sorted);
  } catch (e) {
    return error(res, e.message || 'Failed to fetch login history');
  }
});

module.exports = router;
