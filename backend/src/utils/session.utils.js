// Issues authenticated session cookies (access + refresh), centralizing token signing and
// cookie placement so handlers can (re)establish a session without duplicating the wiring.

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/jwt.config');
const { generateRefreshToken } = require('../services/token.service');
const {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_PATH,
  LEGACY_REFRESH_TOKEN_COOKIE_PATH,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getCookieBaseOptions,
} = require('./cookies.utils');

// Signs a short-lived access token carrying only the id — the one claim any
// server-side check actually reads (see getAuthenticatedUserId). An email
// claim used to ride along too, but nothing ever read it back from the token
// (profile/email always come from a fresh DB read), so it was just dead
// weight that could go stale across an email change; dropped rather than kept in sync.
const createAccessToken = (user) =>
  jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

// Sets a fresh access + refresh token pair as httpOnly cookies on the response.
const issueAuthCookies = (res, user) => {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, createAccessToken(user), getAccessTokenCookieOptions());
  res.cookie(
    REFRESH_TOKEN_COOKIE_NAME,
    generateRefreshToken({ id: user.id }),
    getRefreshTokenCookieOptions(),
  );
  // Sessions issued before the refresh cookie was narrowed to /api/auth carry a
  // copy at the legacy path "/"; drop it here so the first rotation after the
  // change leaves exactly one refresh cookie (the old token is revoked anyway).
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    ...getCookieBaseOptions(),
    path: LEGACY_REFRESH_TOKEN_COOKIE_PATH,
  });
};

// Clears the auth cookies with the same options they were set with (path/flags
// must match for the browser to actually remove them). The refresh cookie is
// also cleared at its legacy path so sessions issued before the path was
// narrowed to /api/auth don't keep a stale copy until it expires.
const clearAuthCookies = (res) => {
  const cookieOptions = getCookieBaseOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, cookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    ...cookieOptions,
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    ...cookieOptions,
    path: LEGACY_REFRESH_TOKEN_COOKIE_PATH,
  });
};

module.exports = { createAccessToken, issueAuthCookies, clearAuthCookies };
