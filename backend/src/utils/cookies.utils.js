/**
 * Cookie utilities for authentication and CSRF.
 *
 * Centralizes cookie names, lifetimes and security flags so that auth cookies
 * are set consistently everywhere. Also provides a dependency-free cookie
 * reader used on requests that are not parsed by cookie-parser.
 */

const ACCESS_TOKEN_COOKIE_NAME = 'frameset_access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'frameset_refresh_token';
const CSRF_TOKEN_COOKIE_NAME = 'frameset_csrf_token';

const ACCESS_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Base security flags shared by all auth cookies.
 * - httpOnly: prevents JavaScript access, mitigating token theft via XSS.
 * - secure: only sent over HTTPS in production (relaxed in dev over http).
 * - sameSite: "strict" in production to block cross-site request inclusion of
 *   the cookie (CSRF defense in depth); "lax" in dev for easier local testing.
 * @returns {{httpOnly:boolean, secure:boolean, sameSite:string, path:string}}
 */
const getCookieBaseOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'strict' : 'lax',
  path: '/'
});

/** Cookie options for the short-lived access token (matches JWT access TTL). */
const getAccessTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  maxAge: ACCESS_TOKEN_MAX_AGE_MS
});

/** Cookie options for the longer-lived refresh token (matches JWT refresh TTL). */
const getRefreshTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  maxAge: REFRESH_TOKEN_MAX_AGE_MS
});

/**
 * Cookie options for the CSRF token.
 * httpOnly is deliberately false: the double-submit cookie pattern requires the
 * frontend JavaScript to read this token and echo it back in a request header,
 * where it is compared against the cookie value server-side.
 */
const getCsrfTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  httpOnly: false,
  maxAge: CSRF_TOKEN_MAX_AGE_MS
});

/**
 * Reads a single cookie value from the raw Cookie request header without
 * relying on cookie-parser middleware. Returns the URL-decoded value or null.
 * @param {Object} req Express request.
 * @param {string} cookieName Name of the cookie to extract.
 * @returns {string|null} The decoded cookie value, or null if absent.
 */
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
  getCookieValue
};
