/**
 * Session helpers: issue the authenticated session cookies (access + refresh).
 *
 * Centralizes access-token signing and cookie placement so handlers that need
 * to (re)establish a session — e.g. changing a password — can re-issue a fresh
 * token pair without duplicating the JWT/cookie wiring.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/jwt.config');
const { generateRefreshToken } = require('../services/token.service');
const {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} = require('./cookies.utils');

/**
 * Signs a short-lived access token carrying the minimal identity claims.
 * @param {{id:number, email:string}} user
 * @returns {string} Signed access JWT.
 */
const createAccessToken = (user) => jwt.sign(
  { id: user.id, email: user.email },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES }
);

/**
 * Issues a fresh access + refresh token pair as httpOnly cookies for the user.
 * @param {Object} res Express response.
 * @param {{id:number, email:string}} user
 */
const issueAuthCookies = (res, user) => {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, createAccessToken(user), getAccessTokenCookieOptions());
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, generateRefreshToken({ id: user.id, email: user.email }), getRefreshTokenCookieOptions());
};

module.exports = { createAccessToken, issueAuthCookies };
