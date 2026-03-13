const { randomBytes, timingSafeEqual } = require('crypto');
const {
  CSRF_TOKEN_COOKIE_NAME,
  getCookieValue,
  getCsrfTokenCookieOptions
} = require('../utils/cookies.utils');

const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const createCsrfToken = () => randomBytes(32).toString('hex');

const ensureCsrfCookie = (req, res, next) => {
  const existingToken = getCookieValue(req, CSRF_TOKEN_COOKIE_NAME);

  if (!existingToken) {
    res.cookie(CSRF_TOKEN_COOKIE_NAME, createCsrfToken(), getCsrfTokenCookieOptions());
  }

  next();
};

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

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = getCookieValue(req, CSRF_TOKEN_COOKIE_NAME);
  const headerValue = req.headers[CSRF_HEADER_NAME];
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!safeTokenEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'Requete CSRF invalide' });
  }

  return next();
};

module.exports = {
  csrfProtection,
  ensureCsrfCookie,
  createCsrfToken
};
