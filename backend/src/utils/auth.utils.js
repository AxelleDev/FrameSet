// Auth helper utilities shared across controllers and middleware.

const { randomInt, createHash } = require('crypto');
const { logger } = require('./logger');

// Returns req.user.id only if a positive integer, else null; never trusts raw token shapes.
const getAuthenticatedUserId = (req) => {
  const userId = Number(req?.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

// Single-use 6-digit verification code (crypto.randomInt, unbiased/unpredictable), valid 10 min.
const generateVerificationCode = () => ({
  code: randomInt(100000, 1000000).toString(),
  expires: new Date(Date.now() + 10 * 60 * 1000)
});

// Irreversible SHA-256 fingerprint (first 12 hex) of an identifier for logs: correlate without
// storing PII in plaintext. Returns null if empty.
const getIdentifierFingerprint = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  return createHash('sha256').update(normalizedValue).digest('hex').slice(0, 12);
};

// Up to two uppercase initials from a display name, for avatar placeholders.
const getInitials = (name) => String(name || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0])
  .join('')
  .substring(0, 2)
  .toUpperCase();

/**
 * Factory: returns an error logger emitting `<namespace>.<operation>.error`,
 * auto-attaching request id and authenticated user id for traceability.
 * @param {string} namespace Logical controller name (e.g. "projects", "users").
 * @returns {(req: Object, operation: string, error: Error, meta?: Object) => void}
 */
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