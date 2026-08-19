const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');
const { TOTP_ENCRYPTION_KEY } = require('../config/totp.config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96-bit IV, the size GCM is designed for.
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Encrypts `plaintext` with a fresh random IV, returning a single
 * self-contained base64 string (iv + ciphertext + auth tag) safe to store in
 * a single text column.
 */
function encryptSecret(plaintext) {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, TOTP_ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

/**
 * Reverses encryptSecret. Throws if the payload is malformed or the auth tag
 * doesn't match (tampered or corrupted ciphertext, or the wrong key) —
 * callers must treat that as "this secret is unusable", never fall back to
 * treating the raw payload as if it were the plaintext.
 */
function decryptSecret(encoded) {
  const payload = Buffer.from(String(encoded), 'base64');
  if (payload.length <= IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Malformed encrypted payload.');
  }

  const iv = payload.subarray(0, IV_LENGTH_BYTES);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH_BYTES);
  const ciphertext = payload.subarray(IV_LENGTH_BYTES, payload.length - AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(ALGORITHM, TOTP_ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
