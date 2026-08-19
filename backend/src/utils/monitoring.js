const { logger } = require('./logger');

let sentry = null;

// Loads and initializes the Sentry SDK when SENTRY_DSN is configured. Called
// once at server startup, before the HTTP server starts accepting traffic.
// Returns whether monitoring is active (used for the startup log).
const initMonitoring = () => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return false;
  }

  try {
    // Lazy require so the SDK is only loaded when monitoring is enabled.
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      // Errors only: tracing stays off so monitoring adds no per-request
      // overhead and no sampled-transaction noise.
      tracesSampleRate: 0,
      // Never attach request bodies / user IPs automatically; our own logs
      // already avoid PII (fingerprinted identifiers) and Sentry should too.
      sendDefaultPii: false,
    });
    sentry = Sentry;
    return true;
  } catch (error) {
    // A broken monitoring setup must never prevent the API from starting.
    logger.error('monitoring.init_failed', { error });
    return false;
  }
};

// Reports an exception with optional context (requestId, path, …). Safe to
// call from anywhere: no-ops until initMonitoring() has succeeded.
const captureException = (error, context) => {
  if (!sentry) {
    return;
  }

  try {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* the reporter itself must never throw into request handling */
  }
};

// Drains queued events before process exit (graceful shutdown, fatal errors),
// so the crash that kills the process is not also the one report we lose.
const flushMonitoring = async (timeoutMs = 2000) => {
  if (!sentry) {
    return;
  }

  try {
    await sentry.flush(timeoutMs);
  } catch {
    /* flushing is best-effort during shutdown */
  }
};

module.exports = {
  initMonitoring,
  captureException,
  flushMonitoring,
};
