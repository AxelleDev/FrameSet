/**
 * Authentication-related helper utilities.
 *
 * Small, reusable functions shared across controllers and middleware: safely
 * extracting the authenticated user id, generating email verification codes,
 * deriving privacy-preserving fingerprints for logging, computing avatar
 * initials, and building namespaced controller error loggers.
 */

const { randomInt, createHash } = require('crypto');
const { logger } = require('./logger');

/**
 * Safely extracts the authenticated user id placed on the request by the auth
 * middleware. Returns null unless it is a positive integer, so callers can
 * reject unauthenticated requests without trusting raw token payload shapes.
 * @param {Object} req Express request (expects req.user.id when authenticated).
 * @returns {number|null} The numeric user id, or null.
 */
const getAuthenticatedUserId = (req) => {
  const userId = Number(req?.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

/**
 * Generates a single-use email verification code and its expiry.
 * Uses crypto.randomInt for an unbiased, cryptographically strong 6-digit code
 * (100000-999999) so codes cannot be guessed or predicted; valid for 10 minutes.
 * @returns {{code: string, expires: Date}}
 */
const generateVerificationCode = () => ({
  code: randomInt(100000, 1000000).toString(),
  expires: new Date(Date.now() + 10 * 60 * 1000)
});

/**
 * Produces a short, irreversible fingerprint of an identifier (e.g. an email)
 * for use in logs. Hashing avoids storing personal data in plaintext logs while
 * still allowing correlation of events for the same identifier.
 * @param {*} value The raw identifier.
 * @returns {string|null} First 12 hex chars of the SHA-256 hash, or null if empty.
 */
const getIdentifierFingerprint = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  return createHash('sha256').update(normalizedValue).digest('hex').slice(0, 12);
};

/**
 * Derives up to two uppercase initials from a display name for use as an avatar
 * placeholder.
 * @param {string} name The user's display name.
 * @returns {string} Up to two uppercase initial letters.
 */
const getInitials = (name) => String(name || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0])
  .join('')
  .substring(0, 2)
  .toUpperCase();

/**
 * Factory that returns a standardized error logger for a controller namespace.
 * The returned function emits a structured error event named
 * `<namespace>.<operation>.error`, automatically attaching the request id and
 * the authenticated user id (when present) for traceability.
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