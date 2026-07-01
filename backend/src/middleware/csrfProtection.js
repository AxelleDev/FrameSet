/**
 * CSRF protection middleware (double-submit cookie pattern).
 *
 * On each request `ensureCsrfCookie` guarantees a non-httpOnly CSRF token
 * cookie exists. For state-changing requests `csrfProtection` requires the
 * client to echo that token in the `x-csrf-token` header; the header value must
 * match the cookie value. Because a cross-site attacker can trigger a request
 * but cannot read the victim's cookie to populate the matching header, forged
 * requests are rejected. The comparison is constant-time to avoid leaking the
 * token via timing.
 */

const { randomBytes, timingSafeEqual } = require('crypto');
const {
  CSRF_TOKEN_COOKIE_NAME,
  getCookieValue,
  getCsrfTokenCookieOptions
} = require('../utils/cookies.utils');

const CSRF_HEADER_NAME = 'x-csrf-token';
// Safe (non-mutating) methods are exempt from CSRF checks per the HTTP spec.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generates a cryptographically random CSRF token (256 bits of entropy).
 * @returns {string} Hex-encoded token.
 */
const createCsrfToken = () => randomBytes(32).toString('hex');

/**
 * Ensures the request carries a CSRF token cookie, issuing one if absent. This
 * cookie is intentionally readable by client JS (not httpOnly) so the frontend
 * can echo it back in the request header for the double-submit check.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 * @param {Function} next Next middleware.
 */
const ensureCsrfCookie = (req, res, next) => {
  const existingToken = getCookieValue(req, CSRF_TOKEN_COOKIE_NAME);

  if (!existingToken) {
    res.cookie(CSRF_TOKEN_COOKIE_NAME, createCsrfToken(), getCsrfTokenCookieOptions());
  }

  next();
};

/**
 * Constant-time comparison of the cookie and header tokens. Using
 * timingSafeEqual (rather than ===) prevents an attacker from inferring the
 * token byte-by-byte through response timing differences. Returns false unless
 * both are equal-length non-empty strings.
 * @param {*} cookieToken Token from the CSRF cookie.
 * @param {*} headerToken Token echoed in the request header.
 * @returns {boolean}
 */
const safeTokenEqual = (cookieToken, headerToken) => {
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
    return false;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (cookieBuffer.length === 0 || cookieBuffer.length !== headerBuffer.length) {
    return false;
  }

  return timingSafeEqual(cookieBuffer, headerBuffer);
};

/**
 * Enforces the double-submit CSRF check on state-changing requests. Safe
 * methods pass through untouched; all others must present a header token that
 * matches the CSRF cookie or receive a 403.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 * @param {Function} next Next middleware.
 */
const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = getCookieValue(req, CSRF_TOKEN_COOKIE_NAME);
  const headerValue = req.headers[CSRF_HEADER_NAME];
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!safeTokenEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'Invalid CSRF request.' });
  }

  return next();
};

module.exports = {
  csrfProtection,
  ensureCsrfCookie,
  createCsrfToken
};
