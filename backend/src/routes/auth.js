const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');
const { generateToken } = require('../middleware/auth');
const { success, error } = require('../utils/response');

let OAuth2Client = null;
try {
  const { OAuth2Client: O2C } = require('google-auth-library');
  OAuth2Client = O2C;
} catch (e) {
  console.warn('[AUTH] google-auth-library not installed — Google Sign-In disabled');
}

const router = express.Router();
const passwordResetCodes = new Map();

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) return error(res, 'Email, password, and full name required', 400);
    if (password.length < 8) return error(res, 'Password must be at least 8 characters', 400);

    const users = await table('users');
    const existing = await users.find({ email: email.toLowerCase() });
    if (existing) return error(res, 'Email already registered', 409);

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const now = new Date().toISOString();
    await users.insert({
      id, email: email.toLowerCase(), password_hash: hash,
      full_name: fullName, created_at: now, updated_at: now
    });
    const token = generateToken(id, email);
    return success(res, { token, user: { id, email, fullName } }, 'Account created', 201);
  } catch (e) {
    console.error('[AUTH] Register error:', e);
    return error(res, e.message || 'Registration failed');
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password required', 400);

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

    const token = generateToken(user.id, user.email);
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

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 15 * 60 * 1000;
    passwordResetCodes.set(email.toLowerCase(), { code, expires, userId: user.id });

    console.log(`[AUTH] Password reset code for ${email}: ${code}`);

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

    const clientId = process.env.GOOGLE_CLIENT_ID || '109956919732-4i8rg4r9p66mhajad8hvjsh7tjs7kmlj.apps.googleusercontent.com';
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

    const token = generateToken(user.id, user.email);
    return success(res, { token, user: { id: user.id, email: user.email, fullName: user.full_name } }, 'Google sign-in successful');
  } catch (e) {
    console.error('[AUTH] Google sign-in error:', e.message);
    return error(res, 'Invalid Google credential', 401);
  }
});

module.exports = router;
