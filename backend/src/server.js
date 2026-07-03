/**
 * Server entry point: starts the HTTP server, schedules revoked-token cleanup,
 * and wires graceful shutdown (drain connections + close DB pool) on SIGTERM/SIGINT.
 */

require('dotenv').config();

const app = require('./app');
const db = require('./database');
const { logger } = require('./utils/logger');
const tokenService = require('./services/token.service');

const PORT = process.env.PORT || 3000;
// Bind address: unset means all interfaces (default). Set HOST to restrict, e.g.
// 127.0.0.1 when the process sits behind a same-host reverse proxy.
const HOST = process.env.HOST;
// Run the revoked-token cleanup once per day.
const REVOKED_TOKENS_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Hard cap on graceful shutdown: if connections don't drain in time, force exit so
// an orchestrator's SIGKILL isn't what ultimately stops us.
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000;
let cleanupInterval;
// Guards against running the shutdown sequence more than once.
let isShuttingDown = false;

// Schedules periodic purge of expired revoked tokens to keep the table bounded.
// The interval is unref()'d so it never keeps the process alive on its own.
const startCleanupScheduler = () => {
  logger.info('token.cleanup.scheduler.started', {
    intervalMs: REVOKED_TOKENS_CLEANUP_INTERVAL_MS,
    frequency: '24h',
    retentionDays: 30,
  });

  cleanupInterval = setInterval(async () => {
    try {
      const hasCleaned = await tokenService.cleanupExpiredRevokedTokens();
      if (!hasCleaned) {
        logger.warn('token.cleanup.completed_with_errors', {
          retentionDays: 30,
        });
        return;
      }

      logger.info('token.cleanup.completed', {
        retentionDays: 30,
      });
    } catch (error) {
      logger.error('token.cleanup.failed', {
        error,
      });
    }
  }, REVOKED_TOKENS_CLEANUP_INTERVAL_MS);

  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  return cleanupInterval;
};

const onServerListening = () => {
  logger.info('server.started', {
    port: Number(PORT),
    host: HOST || '::',
    nodeEnv: process.env.NODE_ENV || 'development',
  });

  startCleanupScheduler();
};

const server = HOST
  ? app.listen(PORT, HOST, onServerListening)
  : app.listen(PORT, onServerListening);

// Promisified server.close(): resolves once connections have drained.
const closeServer = () =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

// Graceful shutdown: stop scheduler, drain server, close DB pool, then exit
// (0 on success, 1 on failure). Idempotent via the isShuttingDown guard.
const shutdownGracefully = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info('Graceful shutdown started', {
    signal,
  });

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  // Force exit if draining stalls (e.g. a lingering keep-alive connection), so we
  // shut down on our own terms rather than waiting for an external SIGKILL.
  const forcedExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit', {
      signal,
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });

    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  if (typeof forcedExitTimer.unref === 'function') {
    forcedExitTimer.unref();
  }

  try {
    // Close idle keep-alive sockets immediately (Node 18+) so only in-flight
    // requests hold the drain open.
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    await closeServer();
    await db.closePool();

    clearTimeout(forcedExitTimer);

    logger.info('Graceful shutdown completed', {
      signal,
    });

    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed', {
      signal,
      error,
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

// Last-resort safety nets: an unhandled rejection or uncaught exception leaves the
// process in an undefined state, so log it and shut down cleanly rather than limp on.
process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandledRejection', {
    error: reason instanceof Error ? reason : new Error(String(reason)),
  });

  void shutdownGracefully('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.error('process.uncaughtException', { error });

  void shutdownGracefully('uncaughtException');
});

module.exports = {
  server,
  startCleanupScheduler,
  shutdownGracefully,
  REVOKED_TOKENS_CLEANUP_INTERVAL_MS,
};
