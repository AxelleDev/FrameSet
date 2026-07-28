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

// Single source of truth for the access token's lifetime: the JWT's own expiry
// (below, in seconds) and the access-token cookie's maxAge (cookies.utils.js)
// both derive from this so the two can never drift out of sync.
const ACCESS_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_MAX_AGE_MS,
  // Short-lived access token limits the exposure window if a token leaks.
  JWT_EXPIRES: ACCESS_TOKEN_MAX_AGE_MS / 1000,
  // Longer-lived refresh token; rotated and revocable server-side.
  JWT_REFRESH_EXPIRES: '7d',
};
