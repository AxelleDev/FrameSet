/**
 * Authentication middleware.
 *
 * Protects routes by validating the access token presented either as a Bearer
 * Authorization header or via the httpOnly access-token cookie. On success it
 * attaches the decoded user and the raw token to the request for downstream
 * handlers; otherwise it short-circuits with an appropriate status.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt.config');
const { isTokenRevoked, isTokenStaleByPasswordChange } = require('../services/token.service');
const { ACCESS_TOKEN_COOKIE_NAME, getCookieValue } = require('../utils/cookies.utils');

/**
 * Express middleware that authenticates the request.
 *
 * Beyond verifying the JWT signature and expiry, it also consults the
 * server-side revocation list so a logged-out or rotated token is rejected even
 * before its natural expiry. A revocation-check failure returns 503 (fail
 * closed) rather than granting access on an unverified state.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 * @param {Function} next Next middleware.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
  const cookieToken = getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);
  // Prefer an explicit Authorization header, falling back to the cookie.
  const token = bearerToken || cookieToken;

  if (!token) return res.status(401).json({ error: 'Token manquant' });

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ error: 'Token invalide ou expiré' });
  }

  if (!user || user.id === null || user.id === undefined) {
    return res.status(403).json({ error: 'Token invalide ou expiré' });
  }

  try {
    // Reject tokens that have been explicitly revoked (logout / rotation).
    const revoked = await isTokenRevoked(user.id, token);
    if (revoked) {
      return res.status(403).json({ error: 'Token invalide ou expiré' });
    }

    // Reject tokens issued before the user's last password change/reset, so a
    // password change invalidates every previously-issued session.
    const stale = await isTokenStaleByPasswordChange(user.id, user.iat);
    if (stale) {
      return res.status(403).json({ error: 'Token invalide ou expiré' });
    }
  } catch (error) {
    // Fail closed: if the revocation store is unavailable, deny rather than
    // risk honoring a possibly-revoked token.
    return res.status(503).json({ error: 'Service temporairement indisponible' });
  }

  req.user = user;
  req.token = token;
  next();
}

module.exports = authenticateToken;
