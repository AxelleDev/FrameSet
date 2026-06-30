/**
 * Server entry point.
 *
 * Loads environment variables, starts the HTTP server, and runs a background
 * scheduler that periodically prunes expired revoked-token records. Also wires
 * graceful shutdown on SIGTERM so the server stops accepting connections and
 * closes the database pool cleanly before exiting.
 */

require('dotenv').config();

const app = require('./app');
const db = require('./database');
const { logger } = require('./utils/logger');
const tokenService = require('./services/token.service');

const PORT = process.env.PORT || 3000;
// Run the revoked-token cleanup once per day.
const REVOKED_TOKENS_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let cleanupInterval;
// Guards against running the shutdown sequence more than once.
let isShuttingDown = false;

/**
 * Starts the periodic scheduler that purges expired revoked tokens, keeping the
 * revoked_tokens table bounded. The interval is unref()'d so it never keeps the
 * process alive on its own (allowing a clean exit during shutdown).
 * @returns {NodeJS.Timeout} The interval handle.
 */
const startCleanupScheduler = () => {
  logger.info('token.cleanup.scheduler.started', {
    intervalMs: REVOKED_TOKENS_CLEANUP_INTERVAL_MS,
    frequency: '24h',
    retentionDays: 30
  });

  cleanupInterval = setInterval(async () => {
    try {
      const hasCleaned = await tokenService.cleanupExpiredRevokedTokens();
      if (!hasCleaned) {
        logger.warn('token.cleanup.completed_with_errors', {
          retentionDays: 30
        });
        return;
      }

      logger.info('token.cleanup.completed', {
        retentionDays: 30
      });
    } catch (error) {
      logger.error('token.cleanup.failed', {
        error
      });
    }
  }, REVOKED_TOKENS_CLEANUP_INTERVAL_MS);

  // Do not let the cleanup timer keep the event loop alive by itself.
  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  return cleanupInterval;
};

const server = app.listen(PORT, () => {
  logger.info('server.started', {
    port: Number(PORT),
    nodeEnv: process.env.NODE_ENV || 'development'
  });

  startCleanupScheduler();
});

/**
 * Promisified server.close(): resolves once the HTTP server stops accepting new
 * connections and existing ones have drained.
 * @returns {Promise<void>}
 */
const closeServer = () => new Promise((resolve, reject) => {
  server.close((error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
  });
});

/**
 * Performs a graceful shutdown: stops the cleanup scheduler, drains the HTTP
 * server and closes the database pool before exiting. Idempotent via the
 * isShuttingDown guard so repeated signals do not run it twice. Exits 0 on
 * success, 1 if teardown fails.
 * @param {string} signal The signal that triggered shutdown (for logging).
 */
const shutdownGracefully = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info('Graceful shutdown started', {
    signal
  });

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  try {
    await closeServer();
    await db.closePool();

    logger.info('Graceful shutdown completed', {
      signal
    });

    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed', {
      signal,
      error
    });

    process.exit(1);
  }
};

// Trigger a graceful shutdown when the process is asked to terminate. SIGTERM
// is sent by orchestrators/process managers; SIGINT is the local Ctrl+C in
// development. Both drain connections and close the pool before exiting.
process.on('SIGTERM', () => {
  void shutdownGracefully('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdownGracefully('SIGINT');
});

module.exports = {
  server,
  startCleanupScheduler,
  shutdownGracefully,
  REVOKED_TOKENS_CLEANUP_INTERVAL_MS
};