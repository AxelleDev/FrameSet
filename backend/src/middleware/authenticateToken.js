const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt.config');
const { isTokenRevoked } = require('../services/token.service');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const user = jwt.verify(token, JWT_SECRET);
    const revoked = await isTokenRevoked(user.id, token);

    if (revoked) {
      return res.status(403).json({ error: 'Token invalide ou expiré' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = authenticateToken;
