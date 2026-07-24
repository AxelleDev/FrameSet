// Auth helper utilities shared across controllers and middleware.

const { randomInt, createHash } = require('crypto');
const { logger } = require('./logger');

// Returns req.user.id only if a positive integer, else null; never trusts raw token shapes.
const getAuthenticatedUserId = (req) => {
  const userId = Number(req?.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

// Extracts a Bearer token from the Authorization header, or null. Shared by the auth
// middleware and the auth controller so the header parsing lives in one place.
const getBearerToken = (req) => {
  const authHeader = req?.headers?.authorization;
  return authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
};

// Single-use 6-digit verification code (crypto.randomInt, unbiased/unpredictable), valid 10 min.
const generateVerificationCode = () => ({
  code: randomInt(100000, 1000000).toString(),
  expires: new Date(Date.now() + 10 * 60 * 1000),
});

// Irreversible SHA-256 fingerprint (first 12 hex) of an identifier for logs: correlate without
// storing PII in plaintext. Returns null if empty.
const getIdentifierFingerprint = (value) => {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  return createHash('sha256').update(normalizedValue).digest('hex').slice(0, 12);
};

// The first letter of a username/pseudo, for avatar placeholders. Usernames
// are a single handle (not a "First Last" name), so the avatar is always
// exactly one letter — trims surrounding whitespace and returns '' for an
// empty/missing name rather than throwing.
const getInitials = (name) => {
  const trimmed = String(name || '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '';
};

/**
 * Factory: returns an error logger emitting `<namespace>.<operation>.error`,
 * auto-attaching request id and authenticated user id for traceability.
 * @param {string} namespace Logical controller name (e.g. "projects", "users").
 * @returns {(req: Object, operation: string, error: Error, meta?: Object) => void}
 */
const createControllerLogger =
  (namespace) =>
  (req, operation, error, meta = {}) => {
    const userId = getAuthenticatedUserId(req);
    const logMeta = {
      requestId: req.id,
      ...meta,
      error,
    };
    if (userId) logMeta.userId = userId;
    logger.error(`${namespace}.${operation}.error`, logMeta);
  };

module.exports = {
  getAuthenticatedUserId,
  getBearerToken,
  generateVerificationCode,
  getIdentifierFingerprint,
  getInitials,
  createControllerLogger,
};
