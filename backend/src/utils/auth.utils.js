const { randomInt, createHash } = require('crypto');

const getAuthenticatedUserId = (req) => {
  const userId = Number(req?.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const generateVerificationCode = () => ({
  code: randomInt(100000, 1000000).toString(),
  expires: new Date(Date.now() + 10 * 60 * 1000)
});

const getIdentifierFingerprint = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  return createHash('sha256').update(normalizedValue).digest('hex').slice(0, 12);
};

module.exports = {
  getAuthenticatedUserId,
  generateVerificationCode,
  getIdentifierFingerprint
};