const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET doit être défini dans les variables d\'environnement');
}
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET doit être défini dans les variables d\'environnement');
}
const JWT_EXPIRES = '2h';
const JWT_REFRESH_EXPIRES = '7d';

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

module.exports = {
  generateRefreshToken,
  verifyRefreshToken
};
