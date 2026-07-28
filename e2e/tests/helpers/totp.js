// Minimal TOTP generator (RFC 6238 on RFC 4226's HOTP), mirroring
// backend/src/utils/totp.js so the 2FA journey can compute real codes from
// the secret shown during enrollment — no mocking, the server verifies them
// exactly like an authenticator app's.
const { createHmac } = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Decode(encoded) {
  const cleaned = String(encoded).toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const char of cleaned) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error('Invalid Base32 character in TOTP secret.');
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * The 6-digit code for `secret` at a given moment (defaults to now).
 *
 * The backend refuses to accept the same 30s time step twice (anti-replay),
 * and its drift window accepts codes one step either side of "now" — so a
 * spec that just consumed a code can pass `at: Date.now() + 30_000` to get
 * the next step's code immediately instead of sleeping 30 seconds.
 */
function generateTotpCode(secret, { at = Date.now() } = {}) {
  const counter = Math.floor(at / 1000 / TOTP_PERIOD_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binaryCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

module.exports = { generateTotpCode };
