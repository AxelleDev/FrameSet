const { randomInt, createHash } = require('crypto');
const { logger } = require('./logger');

const getAuthenticatedUserId = (req) => {
  const userId = Number(req?.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const generateVerificationCode = () => ({
  code: randomInt(100000, 1000000).toString(),
  expires: new Date(Date.now() + 10 * 60 * 1000)
});

const getIdentifierFingerprint = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  return createHash('sha256').update(normalizedValue).digest('hex').slice(0, 12);
};

const getInitials = (name) => String(name || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0])
  .join('')
  .substring(0, 2)
  .toUpperCase();

const createControllerLogger = (namespace) => (req, operation, error, meta = {}) => {
  const userId = getAuthenticatedUserId(req);
  const logMeta = {
    requestId: req.id,
    ...meta,
    error
  };
  if (userId) logMeta.userId = userId;
  logger.error(`${namespace}.${operation}.error`, logMeta);
};

module.exports = {
  getAuthenticatedUserId,
  generateVerificationCode,
  getIdentifierFingerprint,
  getInitials,
  createControllerLogger
};