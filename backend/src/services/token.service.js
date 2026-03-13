const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES } = require('../config/jwt.config');

function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });
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
  try {
    await db.query(
      'INSERT INTO revoked_tokens (user_id, token) VALUES (?, ?)',
      [userId, token]
    );
    return true;
  } catch (error) {
    return false;
  }
}

async function isTokenRevoked(userId, token) {
  try {
    const [rows] = await db.query(
      'SELECT id FROM revoked_tokens WHERE user_id = ? AND token = ? LIMIT 1',
      [userId, token]
    );
    return rows.length > 0;
  } catch (error) {
    return false;
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
