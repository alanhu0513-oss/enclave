const Sentry = require("@sentry/node");

let initialized = false;

function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("[SENTRY] No DSN provided, skipping initialization");
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      release: process.env.npm_package_version || "1.0.0",
      tracesSampleRate: 0.1,
      maxBreadcrumbs: 50,
      attachStacktrace: true,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.authorization;
        }
        if (event.request?.data?.password) {
          event.request.data.password = "[FILTERED]";
        }
        return event;
      }
    });

    if (app) {
      app.use(Sentry.Handlers.requestHandler());
    }

    initialized = true;
    console.log("[SENTRY] Initialized successfully");
  } catch (e) {
    console.warn("[SENTRY] Failed to initialize:", e.message);
  }
}

function captureException(error, context) {
  if (!initialized) return;
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

function captureMessage(message, level = "info") {
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

function addBreadcrumb(category, message, data) {
  if (!initialized) return;
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: "info"
  });
}

function errorHandler() {
  if (!initialized) {
    return (err, req, res, next) => next(err);
  }
  return Sentry.Handlers.errorHandler();
}

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  errorHandler,
  Sentry
};
