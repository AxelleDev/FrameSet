/**
 * Auth middleware: validates the access token (Bearer header or httpOnly cookie)
 * and attaches the decoded user + raw token to the request on success.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt.config');
const {
  isTokenRevoked,
  getUserAuthState,
  isPasswordChangedAfterIssuance,
} = require('../services/token.service');
const { ACCESS_TOKEN_COOKIE_NAME, getCookieValue } = require('../utils/cookies.utils');
const { getBearerToken } = require('../utils/auth.utils');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Beyond signature/expiry, consults the server-side revocation list so a
// logged-out or rotated token is rejected early. Revocation-check failure
// returns 503 (fail closed) rather than granting access on unverified state.
async function authenticateToken(req, res, next) {
  const bearerToken = getBearerToken(req);
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

    // One query covers both checks below (password_updated_at + is_demo live
    // on the same users row): the password-staleness check, needed on every
    // request, and the demo read-only check, needed only on writes. Merged so
    // a mutating request pays one round trip here instead of two.
    const { found, passwordUpdatedAt, isDemo } = await getUserAuthState(user.id);
    if (!found) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // Reject tokens issued before the user's last password change/reset, so a
    // password change invalidates every previously-issued session.
    if (isPasswordChangedAfterIssuance(passwordUpdatedAt, user.iat)) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // The demo account (see migration 019) is read-only: reject any mutating
    // request server-side, so it can't be bypassed from devtools or a direct
    // API call.
    if (MUTATING_METHODS.has(req.method) && isDemo) {
      return res.status(403).json({
        error: 'Demo accounts are read-only. Create a free account to save your own work.',
      });
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
