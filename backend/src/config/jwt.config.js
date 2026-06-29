/**
 * JWT configuration module.
 *
 * Centralizes the secrets and lifetimes used to sign and verify access and
 * refresh tokens. The secrets are read from the environment and validated at
 * import time: the application must fail fast on boot rather than start with a
 * missing or empty signing key, which would silently weaken authentication.
 */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET doit être défini dans les variables d\'environnement');
}

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET doit être défini dans les variables d\'environnement');
}

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  // Short-lived access token limits the exposure window if a token leaks.
  JWT_EXPIRES: '2h',
  // Longer-lived refresh token; rotated and revocable server-side.
  JWT_REFRESH_EXPIRES: '7d'
};
