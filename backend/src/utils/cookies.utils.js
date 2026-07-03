// Auth/CSRF cookie names, lifetimes and security flags, set consistently everywhere.
// Also a dependency-free cookie reader for requests not parsed by cookie-parser.

const ACCESS_TOKEN_COOKIE_NAME = 'frameset_access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'frameset_refresh_token';
const CSRF_TOKEN_COOKIE_NAME = 'frameset_csrf_token';

const ACCESS_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === 'production';

// Base security flags for all auth cookies:
// - httpOnly: no JS access, mitigates token theft via XSS.
// - secure: HTTPS-only in production (relaxed in dev over http).
// - sameSite: "strict" in prod blocks cross-site inclusion (CSRF defense in depth); "lax" in dev.
const getCookieBaseOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'strict' : 'lax',
  path: '/',
});

/** Cookie options for the short-lived access token (matches JWT access TTL). */
const getAccessTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  maxAge: ACCESS_TOKEN_MAX_AGE_MS,
});

/** Cookie options for the longer-lived refresh token (matches JWT refresh TTL). */
const getRefreshTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  maxAge: REFRESH_TOKEN_MAX_AGE_MS,
});

// CSRF token cookie options. httpOnly is deliberately false: the double-submit pattern needs
// frontend JS to read the token and echo it in a header, compared against the cookie server-side.
const getCsrfTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  httpOnly: false,
  maxAge: CSRF_TOKEN_MAX_AGE_MS,
});

// Reads one cookie from the raw Cookie header (no cookie-parser); URL-decoded value or null.
const getCookieValue = (req, cookieName) => {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader || !cookieName) {
    return null;
  }

  const cookiePart = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!cookiePart) {
    return null;
  }

  const rawValue = cookiePart.slice(cookieName.length + 1);
  return decodeURIComponent(rawValue || '');
};

module.exports = {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_COOKIE_NAME,
  getCookieBaseOptions,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getCsrfTokenCookieOptions,
  getCookieValue,
};
