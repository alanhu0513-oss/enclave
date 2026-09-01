/* ─── Enclave WebSocket Server ───
 * Socket.IO server attached to the HTTP server.
 * Provides real-time push for notifications, alerts, scan progress.
 * JWT authentication on connection. Users join personal rooms.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { bus, Events } = require('./event-bus');

let io = null;

/* ─── JWT Auth Middleware ─── */
function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && !['dev-secret-change-me', 'change-me-in-production', 'enclave_jwt_secret_change_in_production'].includes(secret)) {
    return secret;
  }
  const crypto = require('crypto');
  if (!global.__jwtSecret) global.__jwtSecret = crypto.randomBytes(48).toString('hex');
  return global.__jwtSecret;
}

function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, resolveJwtSecret());
    socket.userId = decoded.userId || decoded.sub;
    socket.userEmail = decoded.email;
    if (!socket.userId) return next(new Error('Invalid token payload'));
    next();
  } catch (e) {
    next(new Error('Invalid or expired token'));
  }
}

/* ─── Initialize ─── */
function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:4000',
        'https://enclave-react.vercel.app',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 10000,
    transports: ['websocket', 'polling'],
  });

  io.use(authMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[WS] User connected: ${userId}`);

    // Join user's personal room for targeted pushes
    socket.join(`user:${userId}`);

    // Send connection confirmation
    socket.emit('connected', { userId, timestamp: Date.now() });

    // Handle subscription to specific alert types
    socket.on('subscribe:alerts', (types) => {
      if (Array.isArray(types)) {
        types.forEach(t => socket.join(`alerts:${userId}:${t}`));
      }
    });

    socket.on('unsubscribe:alerts', (types) => {
      if (Array.isArray(types)) {
        types.forEach(t => socket.leave(`alerts:${userId}:${t}`));
      }
    });

    // Handle scan progress acknowledgment
    socket.on('scan:ack', (scanId) => {
      console.log(`[WS] Scan acknowledged: ${scanId} by ${userId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WS] User disconnected: ${userId} (${reason})`);
    });
  });

  /* ─── Event Bus → WebSocket Bridge ─── */

  // New notification → push to user
  bus.on(Events.NOTIFICATION_CREATED, ({ userId, notification }) => {
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }
  });

  // New alert → push to user
  bus.on(Events.ALERT_CREATED, ({ userId, alert }) => {
    if (io) {
      io.to(`user:${userId}`).emit('alert:new', alert);
    }
  });

  // Alert resolved → push to user
  bus.on(Events.ALERT_RESOLVED, ({ userId, alertId }) => {
    if (io) {
      io.to(`user:${userId}`).emit('alert:resolved', { alertId });
    }
  });

  // Scan progress → push to user
  bus.on(Events.SCAN_PROGRESS, ({ userId, scanId, progress }) => {
    if (io) {
      io.to(`user:${userId}`).emit('scan:progress', { scanId, ...progress });
    }
  });

  // Scan completed → push to user
  bus.on(Events.SCAN_COMPLETED, ({ userId, scanType, result }) => {
    if (io) {
      io.to(`user:${userId}`).emit('scan:completed', { scanType, result });
    }
  });

  // Scan failed → push to user
  bus.on(Events.SCAN_FAILED, ({ userId, scanType, error }) => {
    if (io) {
      io.to(`user:${userId}`).emit('scan:failed', { scanType, error });
    }
  });

  // Takedown events → push to user
  bus.on(Events.TAKEDOWN_INITIATED, ({ userId, takedown }) => {
    if (io) {
      io.to(`user:${userId}`).emit('takedown:initiated', takedown);
    }
  });

  bus.on(Events.TAKEDOWN_COMPLETED, ({ userId, takedown }) => {
    if (io) {
      io.to(`user:${userId}`).emit('takedown:completed', takedown);
    }
  });

  // Monitor cycle completed → push to user
  bus.on(Events.MONITOR_CYCLE_COMPLETED, ({ userId, result }) => {
    if (io) {
      io.to(`user:${userId}`).emit('monitor:cycle:completed', result);
    }
  });

  // Usage limit reached → push to user
  bus.on(Events.USAGE_LIMIT_REACHED, ({ userId, data }) => {
    if (io) {
      io.to(`user:${userId}`).emit('usage:limit:reached', data);
    }
  });

  console.log('[WS] WebSocket server initialized');
  return io;
}

function getIo() {
  return io;
}

function broadcastToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

function broadcastToAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

function getConnectedCount() {
  if (!io) return 0;
  return io.engine.clientsCount || 0;
}

module.exports = {
  init,
  getIo,
  broadcastToUser,
  broadcastToAll,
  getConnectedCount,
};
