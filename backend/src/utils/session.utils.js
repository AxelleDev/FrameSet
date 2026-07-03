// Issues authenticated session cookies (access + refresh), centralizing token signing and
// cookie placement so handlers can (re)establish a session without duplicating the wiring.

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/jwt.config');
const { generateRefreshToken } = require('../services/token.service');
const {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} = require('./cookies.utils');

// Signs a short-lived access token carrying minimal identity claims (id, email).
const createAccessToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

// Sets a fresh access + refresh token pair as httpOnly cookies on the response.
const issueAuthCookies = (res, user) => {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, createAccessToken(user), getAccessTokenCookieOptions());
  res.cookie(
    REFRESH_TOKEN_COOKIE_NAME,
    generateRefreshToken({ id: user.id, email: user.email }),
    getRefreshTokenCookieOptions(),
  );
};

module.exports = { createAccessToken, issueAuthCookies };
