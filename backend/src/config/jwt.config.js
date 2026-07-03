/**
 * JWT secrets and token lifetimes. Secrets are validated at import time so the
 * app fails fast on boot rather than start with a missing or weak signing key.
 */

// Enforce a minimum secret length only in production: dev/test can use short,
// throwaway secrets, but a real deployment must not ship a guessable signing key.
const MIN_SECRET_LENGTH = 32;
const isProduction = process.env.NODE_ENV === 'production';

const requireSecret = (value, name) => {
  if (!value) {
    throw new Error(`${name} must be defined in the environment variables`);
  }
  if (isProduction && value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters in production`);
  }
  return value;
};

const JWT_SECRET = requireSecret(process.env.JWT_SECRET, 'JWT_SECRET');
const JWT_REFRESH_SECRET = requireSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  // Short-lived access token limits the exposure window if a token leaks.
  JWT_EXPIRES: '2h',
  // Longer-lived refresh token; rotated and revocable server-side.
  JWT_REFRESH_EXPIRES: '7d'
};
