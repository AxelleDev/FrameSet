/**
 * Token service: refresh-token issuance and a stateful revocation layer over stateless JWTs.
 * Revoked tokens are stored hashed in revoked_tokens so logout/rotation can invalidate before JWT expiry.
 */

const jwt = require('jsonwebtoken');
const { createHash, randomUUID } = require('crypto');
const db = require('../database');
const { JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES } = require('../config/jwt.config');

// Hashes a token for the revocation table so the raw bearer credential is never
// stored: leaking the table doesn't leak usable tokens. Returns null on invalid input.
function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  return createHash('sha256').update(token).digest('hex');
}

// Signs a refresh token with a unique jti so each issued token is distinct,
// supporting rotation (every refresh mints a new token for the same payload).
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES,
    jwtid: randomUUID(),
  });
}

// Verifies a refresh token's signature and expiry; returns the decoded payload or null.
function verifyRefreshToken(token) {
  try {
    const user = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    return user;
  } catch (err) {
    return null;
  }
}

// Records a token as revoked (logout/rotation), storing only the hash. INSERT IGNORE
// makes this an atomic claim: it returns true only when THIS call inserted the row,
// and false when the row already existed (someone else revoked it first) or on invalid
// input / DB error. Rotation relies on that to let only one of two concurrent refreshes
// through; logout ignores the return and just needs the row to exist.
async function revokeToken(userId, token) {
  const tokenHash = hashToken(token);
  if (!tokenHash) {
    return false;
  }

  try {
    const [result] = await db.query(
      'INSERT IGNORE INTO revoked_tokens (user_id, token) VALUES (?, ?)',
      [userId, tokenHash],
    );
    return result?.affectedRows === 1;
  } catch (error) {
    return false;
  }
}

// Whether a token is revoked for the user; rejects revoked-but-not-yet-expired
// JWTs. Fails closed: invalid input counts as revoked, and a DB error throws
// TOKEN_REVOCATION_CHECK_FAILED rather than authenticating on a stale check.
async function isTokenRevoked(userId, token) {
  const tokenHash = hashToken(token);
  if (!tokenHash || userId === null || userId === undefined) {
    return true;
  }

  try {
    const [rows] = await db.query(
      'SELECT id FROM revoked_tokens WHERE user_id = ? AND token = ? LIMIT 1',
      [userId, tokenHash],
    );
    return rows.length > 0;
  } catch (error) {
    const revocationCheckError = new Error('TOKEN_REVOCATION_CHECK_FAILED');
    revocationCheckError.cause = error;
    throw revocationCheckError;
  }
}

// Pure comparison shared by isTokenStaleByPasswordChange (below) and
// authenticateToken's merged user-state query: whether a password change
// postdates a token's issuance. A 5s leeway absorbs app/DB clock skew so a
// freshly re-issued token isn't wrongly rejected. A missing changedAt (no
// password has ever been set) can never make a token stale.
function isPasswordChangedAfterIssuance(passwordUpdatedAt, tokenIatSeconds) {
  if (!tokenIatSeconds || !passwordUpdatedAt) {
    return false;
  }

  const changedAtSeconds = Math.floor(new Date(passwordUpdatedAt).getTime() / 1000);
  return changedAtSeconds > tokenIatSeconds + 5;
}

// Whether a token predates the user's last password change (iat vs
// password_updated_at), invalidating every session minted before a change/reset.
// A missing user counts as invalidated. Throws CREDENTIALS_CHECK_FAILED on DB error.
async function isTokenStaleByPasswordChange(userId, tokenIatSeconds) {
  if (userId === null || userId === undefined) {
    return true;
  }
  // No issue time -> cannot prove the token post-dates a password change.
  if (!tokenIatSeconds) {
    return false;
  }

  try {
    const [rows] = await db.query('SELECT password_updated_at FROM users WHERE id = ? LIMIT 1', [
      userId,
    ]);
    if (rows.length === 0) {
      return true;
    }

    return isPasswordChangedAfterIssuance(rows[0].password_updated_at, tokenIatSeconds);
  } catch (error) {
    const credentialsCheckError = new Error('CREDENTIALS_CHECK_FAILED');
    credentialsCheckError.cause = error;
    throw credentialsCheckError;
  }
}

// Merged read for the authenticateToken hot path: previously a mutating
// request ran the staleness check's own query (password_updated_at) AND a
// separate query for is_demo — two round trips on top of the revocation
// check. One query now covers both, since both live on the same users row.
// Throws USER_STATE_CHECK_FAILED on DB error (fail closed, same as above).
async function getUserAuthState(userId) {
  if (userId === null || userId === undefined) {
    return { found: false, passwordUpdatedAt: null, isDemo: false };
  }

  try {
    const [rows] = await db.query(
      'SELECT password_updated_at, is_demo FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    if (rows.length === 0) {
      return { found: false, passwordUpdatedAt: null, isDemo: false };
    }

    return {
      found: true,
      passwordUpdatedAt: rows[0].password_updated_at,
      isDemo: Boolean(rows[0].is_demo),
    };
  } catch (error) {
    const userStateCheckError = new Error('USER_STATE_CHECK_FAILED');
    userStateCheckError.cause = error;
    throw userStateCheckError;
  }
}

// Prunes revocation records past the retention window: once a JWT has expired its
// entry is moot, so dropping it keeps the table bounded. Run by the cleanup scheduler.
async function cleanupExpiredRevokedTokens() {
  try {
    await db.query(
      'DELETE FROM revoked_tokens WHERE revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
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
  isTokenStaleByPasswordChange,
  isPasswordChangedAfterIssuance,
  getUserAuthState,
  cleanupExpiredRevokedTokens,
};
