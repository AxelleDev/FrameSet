/**
 * Password security configuration module.
 *
 * Exposes the bcrypt work factor and the password policy (minimum length and
 * complexity) enforced during registration and password changes. Keeping these
 * values in one place ensures the same rules are applied consistently across
 * every controller that handles credentials.
 */

// Default bcrypt cost factor. 12 rounds is a sensible balance between hashing
// cost (resistance to brute force) and login latency on commodity hardware.
const DEFAULT_BCRYPT_SALT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;
// Requires at least one lowercase letter, one uppercase letter and one digit,
// with a minimum length of 8 characters.
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const parsedRounds = Number(process.env.BCRYPT_SALT_ROUNDS);

// Allow tuning the cost factor via env, but never below 4 (bcrypt's practical
// minimum); fall back to the secure default for any invalid value.
const BCRYPT_SALT_ROUNDS = Number.isInteger(parsedRounds) && parsedRounds >= 4
  ? parsedRounds
  : DEFAULT_BCRYPT_SALT_ROUNDS;

module.exports = {
  BCRYPT_SALT_ROUNDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_COMPLEXITY_REGEX
};