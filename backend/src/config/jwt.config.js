/**
 * JWT secrets and token lifetimes. Secrets are validated at import time so the
 * app fails fast on boot rather than start with a missing signing key.
 */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in the environment variables');
}

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET must be defined in the environment variables');
}

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  // Short-lived access token limits the exposure window if a token leaks.
  JWT_EXPIRES: '2h',
  // Longer-lived refresh token; rotated and revocable server-side.
  JWT_REFRESH_EXPIRES: '7d'
};
