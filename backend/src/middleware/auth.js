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

function generateToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 'Authentication required', 401);
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return error(res, 'Invalid or expired token', 401);
  }
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

module.exports = { generateToken, authenticate, optionalAuth, JWT_SECRET };
