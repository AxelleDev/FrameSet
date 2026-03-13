const ACCESS_TOKEN_COOKIE_NAME = 'frameset_access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'frameset_refresh_token';
const CSRF_TOKEN_COOKIE_NAME = 'frameset_csrf_token';

const ACCESS_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === 'production';

const getCookieBaseOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'strict' : 'lax',
  path: '/'
});

const getAccessTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  maxAge: ACCESS_TOKEN_MAX_AGE_MS
});

const getRefreshTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  maxAge: REFRESH_TOKEN_MAX_AGE_MS
});

const getCsrfTokenCookieOptions = () => ({
  ...getCookieBaseOptions(),
  httpOnly: false,
  maxAge: CSRF_TOKEN_MAX_AGE_MS
});

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
