const jwt = require('jsonwebtoken');
const { createHash, randomUUID } = require('crypto');
const db = require('../database');
const { JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES } = require('../config/jwt.config');

function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  return createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES,
    jwtid: randomUUID()
  });
}

function verifyRefreshToken(token) {
  try {
     const user = jwt.verify(token, JWT_REFRESH_SECRET);
     return user;
  } catch (err) {
     return null;
  }
}

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

async function cleanupExpiredRevokedTokens() {
  try {
    // Supprimer les tokens révoqués depuis plus de 30 jours
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
