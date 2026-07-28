/**
 * TOTP (RFC 6238, built on the HOTP counter algorithm of RFC 4226) implemented
 * directly on Node's crypto module — HMAC-SHA1 and a fixed-size counter are
 * all the primitives it needs, so pulling in a dependency for this would just
 * be trading a few dozen lines of well-specified math for supply-chain risk.
 *
 * Secrets are generated and exchanged as Base32 (RFC 4648, unpadded): that is
 * the encoding every authenticator app (Google Authenticator, Authy, 1Password…)
 * expects in an otpauth:// URI or a manually-typed setup key.
 */

const { randomBytes, createHmac, timingSafeEqual } = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SECRET_LENGTH_BYTES = 20; // 160 bits, the size the RFC's reference implementation uses.
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
// Attempts within this many time steps either side of "now" succeed, to
// absorb clock drift between the server and the user's device.
const DEFAULT_WINDOW_STEPS = 1;

/** Encodes bytes as unpadded Base32 (RFC 4648 alphabet, sans "=" padding). */
function base32Encode(bytes) {
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let output = '';
  for (let i = 0; i + 5 <= bits.length || i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

/** Decodes unpadded (or padded) Base32 back to raw bytes. */
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

/** Fresh random Base32-encoded secret, ready to store (encrypted) and display. */
function generateTotpSecret() {
  return base32Encode(randomBytes(SECRET_LENGTH_BYTES));
}

/**
 * otpauth:// URI an authenticator app scans as a QR code. `issuer` and
 * `accountName` both appear in the app's entry list, so the user can tell
 * which FrameSet account this is for.
 */
function buildOtpauthUrl({ secret, accountName, issuer = 'FrameSet' }) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** HOTP (RFC 4226): HMAC-SHA1 of the counter, dynamically truncated to `digits`. */
function computeHotp(secretBytes, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', secretBytes).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binaryCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/** The current TOTP code for `secret` (Base32), for a given moment (defaults to now). */
function generateTotpCode(secret, { at = Date.now() } = {}) {
  const counter = Math.floor(at / 1000 / TOTP_PERIOD_SECONDS);
  return computeHotp(base32Decode(secret), counter);
}

/**
 * Matches a candidate code against `secret`, trying the current time step and
 * `window` steps either side (clock-drift tolerance). Each comparison is
 * constant-time. Returns the matched time-step counter — which the caller can
 * persist to reject any replay of the same code (RFC 6238 §5.2) — or null if
 * nothing matched.
 */
function matchTotpCode(secret, candidate, { at = Date.now(), window = DEFAULT_WINDOW_STEPS } = {}) {
  if (typeof candidate !== 'string' || !/^\d{6}$/.test(candidate)) {
    return null;
  }

  const secretBytes = base32Decode(secret);
  const currentCounter = Math.floor(at / 1000 / TOTP_PERIOD_SECONDS);
  const candidateBuffer = Buffer.from(candidate);

  for (let stepOffset = -window; stepOffset <= window; stepOffset += 1) {
    const expected = computeHotp(secretBytes, currentCounter + stepOffset);
    const expectedBuffer = Buffer.from(expected);
    if (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    ) {
      return currentCounter + stepOffset;
    }
  }

  return null;
}

/** Whether `candidate` is valid for `secret` right now (see matchTotpCode). */
function verifyTotpCode(secret, candidate, options = {}) {
  return matchTotpCode(secret, candidate, options) !== null;
}

module.exports = {
  generateTotpSecret,
  buildOtpauthUrl,
  generateTotpCode,
  matchTotpCode,
  verifyTotpCode,
  base32Encode,
  base32Decode,
};
