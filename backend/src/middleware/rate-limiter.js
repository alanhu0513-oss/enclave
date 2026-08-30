const rateLimit = require("express-rate-limit");

const STORE = new Map();
const WINDOW_MS = 60 * 1000;

function getStoreKey(ip, userId) {
  return userId ? `user:${userId}` : `ip:${ip}`;
}

function slidingWindowLimiter({ windowMs = WINDOW_MS, max = 60, keyBy = "ip", message = "Too many requests" } = {}) {
  return (req, res, next) => {
    const key = keyBy === "user" && req.userId
      ? getStoreKey(null, req.userId)
      : getStoreKey(req.ip || req.connection?.remoteAddress || "unknown");

    const now = Date.now();
    const windowStart = now - windowMs;

    let record = STORE.get(key);
    if (!record || record.windowStart < windowStart) {
      record = { requests: [], windowStart: now };
      STORE.set(key, record);
    }

    record.requests = record.requests.filter((t) => t > windowStart);

    if (record.requests.length >= max) {
      const retryAfter = Math.ceil((record.requests[0] + windowMs - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", "0");
      res.set("X-RateLimit-Reset", String(Math.ceil((windowStart + windowMs) / 1000)));
      return res.status(429).json({ error: message, retryAfter });
    }

    record.requests.push(now);

    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(max - record.requests.length));
    res.set("X-RateLimit-Reset", String(Math.ceil((windowStart + windowMs) / 1000)));

    next();
  };
}

const globalLimiter = slidingWindowLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Global rate limit exceeded"
});

const authLimiter = slidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many auth attempts"
});

const scanLimiter = slidingWindowLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyBy: "user",
  message: "Scan rate limit exceeded"
});

const apiLimiter = slidingWindowLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyBy: "user",
  message: "API rate limit exceeded"
});

const billingLimiter = slidingWindowLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyBy: "user",
  message: "Billing rate limit exceeded"
});

const uploadLimiter = slidingWindowLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyBy: "user",
  message: "Upload rate limit exceeded"
});

function cleanupStore() {
  const now = Date.now();
  for (const [key, record] of STORE.entries()) {
    if (record.windowStart < now - WINDOW_MS * 2) {
      STORE.delete(key);
    }
  }
}

setInterval(cleanupStore, 5 * 60 * 1000);

module.exports = {
  globalLimiter,
  authLimiter,
  scanLimiter,
  apiLimiter,
  billingLimiter,
  uploadLimiter,
  slidingWindowLimiter
};
