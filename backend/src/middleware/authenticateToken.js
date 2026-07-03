/**
 * Auth middleware: validates the access token (Bearer header or httpOnly cookie)
 * and attaches the decoded user + raw token to the request on success.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt.config');
const { isTokenRevoked, isTokenStaleByPasswordChange } = require('../services/token.service');
const { ACCESS_TOKEN_COOKIE_NAME, getCookieValue } = require('../utils/cookies.utils');

// Beyond signature/expiry, consults the server-side revocation list so a
// logged-out or rotated token is rejected early. Revocation-check failure
// returns 503 (fail closed) rather than granting access on unverified state.
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
  const cookieToken = getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);
  // Prefer an explicit Authorization header, falling back to the cookie.
  const token = bearerToken || cookieToken;

  if (!token) return res.status(401).json({ error: 'Missing token.' });

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }

  if (!user || user.id === null || user.id === undefined) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }

  try {
    // Reject tokens that have been explicitly revoked (logout / rotation).
    const revoked = await isTokenRevoked(user.id, token);
    if (revoked) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // Reject tokens issued before the user's last password change/reset, so a
    // password change invalidates every previously-issued session.
    const stale = await isTokenStaleByPasswordChange(user.id, user.iat);
    if (stale) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
  } catch (error) {
    // Fail closed: if the revocation store is unavailable, deny rather than
    // risk honoring a possibly-revoked token.
    return res.status(503).json({ error: 'Service temporarily unavailable.' });
  }

  req.user = user;
  req.token = token;
  next();
}

module.exports = authenticateToken;
