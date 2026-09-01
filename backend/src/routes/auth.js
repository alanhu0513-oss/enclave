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
    return success(res, { token, user: { id, email, fullName } }, 'Account created', 201);
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
    return success(res, { token, user: { id: user.id, email: user.email, fullName: user.full_name } }, 'Password changed');
  } catch (e) {
    return error(res, e.message || 'Change password failed');
  }
});

module.exports = router;
