/**
 * Token service: refresh token issuance and server-side revocation.
 *
 * Implements a stateful revocation layer on top of stateless JWTs. Revoked
 * tokens are persisted (as hashes) in the revoked_tokens table so that logout
 * and refresh-token rotation can immediately invalidate a token before its JWT
 * expiry. Tokens are stored hashed (never in plaintext) to limit the impact of
 * a database disclosure.
 */

const jwt = require('jsonwebtoken');
const { createHash, randomUUID } = require('crypto');
const db = require('../database');
const { JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES } = require('../config/jwt.config');

/**
 * Hashes a token for storage/lookup in the revocation table. Hashing means the
 * raw token (a bearer credential) is never written to the database, so leaking
 * the table does not leak usable tokens.
 * @param {string} token Raw JWT string.
 * @returns {string|null} SHA-256 hex digest, or null for invalid input.
 */
function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  return createHash('sha256').update(token).digest('hex');
}

/**
 * Signs a new refresh token. A unique jwtid (jti) is embedded so that each
 * issued token is distinct; this supports rotation, where every refresh mints a
 * brand-new token even for the same user/payload.
 * @param {Object} payload Claims to embed (e.g. { id, email }).
 * @returns {string} Signed refresh JWT.
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES,
    jwtid: randomUUID()
  });
}

/**
 * Verifies a refresh token's signature and expiry.
 * @param {string} token Raw refresh JWT.
 * @returns {Object|null} Decoded payload if valid, otherwise null.
 */
function verifyRefreshToken(token) {
  try {
     const user = jwt.verify(token, JWT_REFRESH_SECRET);
     return user;
  } catch (err) {
     return null;
  }
}

/**
 * Records a token as revoked for the given user. Used on logout and during
 * refresh-token rotation to invalidate the previous token immediately. Stores
 * only the hash; INSERT IGNORE makes repeated revocations idempotent.
 * @param {number} userId Owner of the token.
 * @param {string} token Raw JWT to revoke.
 * @returns {Promise<boolean>} True on success, false on invalid input or DB error.
 */
async function revokeToken(userId, token) {
  const tokenHash = hashToken(token);
  if (!tokenHash) {
    return false;
  }

  try {
    await db.query(
      'INSERT IGNORE INTO revoked_tokens (user_id, token) VALUES (?, ?)',
      [userId, tokenHash]
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Checks whether a token has been revoked for the given user. Called by the
 * auth middleware and refresh flow so that revoked-but-not-yet-expired JWTs are
 * rejected. Fails closed: invalid input is treated as revoked, and a DB error
 * throws (rather than silently allowing access) so the caller can respond with
 * a service-unavailable status instead of authenticating on a stale check.
 * @param {number} userId Owner of the token.
 * @param {string} token Raw JWT to check.
 * @returns {Promise<boolean>} True if revoked (or input invalid).
 * @throws {Error} TOKEN_REVOCATION_CHECK_FAILED when the lookup query fails.
 */
async function isTokenRevoked(userId, token) {
  const tokenHash = hashToken(token);
  if (!tokenHash || userId === null || userId === undefined) {
    return true;
  }

  try {
    const [rows] = await db.query(
      'SELECT id FROM revoked_tokens WHERE user_id = ? AND token = ? LIMIT 1',
      [userId, tokenHash]
    );
    return rows.length > 0;
  } catch (error) {
    const revocationCheckError = new Error('TOKEN_REVOCATION_CHECK_FAILED');
    revocationCheckError.cause = error;
    throw revocationCheckError;
  }
}

/**
 * Purges revocation records older than the retention window. Once a token's JWT
 * has expired it can no longer be used, so its revocation entry is no longer
 * needed; pruning keeps the table bounded. Invoked periodically by the server's
 * cleanup scheduler.
 * @returns {Promise<boolean>} True on success, false on DB error.
 */
async function cleanupExpiredRevokedTokens() {
  try {
    // Delete tokens that were revoked more than 30 days ago.
    await db.query(
      'DELETE FROM revoked_tokens WHERE revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  generateRefreshToken,
  verifyRefreshToken,
  revokeToken,
  isTokenRevoked,
  cleanupExpiredRevokedTokens
};
