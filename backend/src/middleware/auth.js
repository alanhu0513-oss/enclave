const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret !== 'dev-secret-change-me' && secret !== 'change-me-in-production' && !secret.startsWith('enclave_jwt_secret_change_in_production')) {
    return secret;
  }
  const generated = crypto.randomBytes(48).toString('base64');
  console.warn('[AUTH] JWT_SECRET not set or using default — generated random secret for this session.');
  console.warn('[AUTH] Set JWT_SECRET in .env for persistent tokens across restarts.');
  return generated;
}

const JWT_SECRET = resolveJwtSecret();

function generateToken(userId, email, extra = {}) {
  return jwt.sign({ userId, email, ...extra }, JWT_SECRET, { expiresIn: '7d' });
}

// Generate a token bound to the user's current token_version so that
// revoking (incrementing token_version) immediately invalidates all prior tokens.
async function generateTokenForUser(user) {
  const { table } = require('../db/query');
  const users = await table('users');
  const row = user.version != null ? user : await users.find({ id: user.id });
  const tv = (row && (row.token_version ?? row.version)) || 0;
  return generateToken(user.id, user.email, { tv });
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 'Authentication required', 401);
  }
  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
  } catch (e) {
    return error(res, 'Invalid or expired token', 401);
  }
  req.user = decoded;
  // If the token carries a token_version claim, verify it hasn't been revoked.
  if (decoded.tv != null) {
    try {
      const { table } = require('../db/query');
      const users = await table('users');
      const row = await users.find({ id: decoded.userId });
      const currentTv = (row && (row.token_version ?? row.version)) || 0;
      if (!row || currentTv !== decoded.tv) {
        return error(res, 'Invalid or expired token', 401);
      }
    } catch (e) {
      return error(res, 'Invalid or expired token', 401);
    }
  }
  next();
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.user = decoded;
  } catch (e) {
    req.user = null;
  }
  next();
}

module.exports = { generateToken, generateTokenForUser, authenticate, optionalAuth, JWT_SECRET };
