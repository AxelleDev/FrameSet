const jwt = require('jsonwebtoken');
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

module.exports = {
  generateRefreshToken,
  verifyRefreshToken
};
