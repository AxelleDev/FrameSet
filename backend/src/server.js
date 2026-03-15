require('dotenv').config();

const app = require('./app');
const { logger } = require('./utils/logger');
const tokenService = require('./services/token.service');

const PORT = process.env.PORT || 3000;
const REVOKED_TOKENS_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

app.listen(PORT, () => {
  logger.info('server.started', {
    port: Number(PORT),
    nodeEnv: process.env.NODE_ENV || 'development'
  });

  logger.info('token.cleanup.scheduler.started', {
    intervalMs: REVOKED_TOKENS_CLEANUP_INTERVAL_MS,
    frequency: '24h',
    retentionDays: 30
  });

  const cleanupInterval = setInterval(async () => {
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

  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }
});