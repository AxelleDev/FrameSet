const { randomBytes, timingSafeEqual } = require('crypto');
const {
  CSRF_TOKEN_COOKIE_NAME,
  getCookieValue,
  getCsrfTokenCookieOptions,
} = require('../utils/cookies.utils');

const CSRF_HEADER_NAME = 'x-csrf-token';
// Safe (non-mutating) methods are exempt from CSRF checks per the HTTP spec.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Cryptographically random CSRF token (256 bits, hex-encoded).
const createCsrfToken = () => randomBytes(32).toString('hex');

// Issues the CSRF cookie if absent. Intentionally not httpOnly so the frontend
// can read it and echo it back in the header for the double-submit check.
const ensureCsrfCookie = (req, res, next) => {
  const existingToken = getCookieValue(req, CSRF_TOKEN_COOKIE_NAME);

  if (!existingToken) {
    res.cookie(CSRF_TOKEN_COOKIE_NAME, createCsrfToken(), getCsrfTokenCookieOptions());
  }

  next();
};

// Constant-time comparison (timingSafeEqual, not ===) so an attacker cannot infer
// the token byte-by-byte via timing. False unless both are equal-length non-empty strings.
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

// Enforces the double-submit check on state-changing requests: safe methods pass
// through, all others need a header token matching the CSRF cookie or get a 403.
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
  createCsrfToken,
};
