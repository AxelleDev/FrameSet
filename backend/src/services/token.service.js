const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_key';
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
