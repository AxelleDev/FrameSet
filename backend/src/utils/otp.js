/**
 * Helpers for one-time codes (email verification, password reset, email change).
 * Codes are stored **hashed** (SHA-256), never in clear text: read access to the
 * database (dump, stolen backup…) therefore reveals no usable code. The comparison
 * is constant-time so nothing leaks through timing.
 */

const { createHash, timingSafeEqual } = require('crypto');

// Past this number of wrong attempts the code is invalidated (on top of the per-IP
// rate limit), to defeat a distributed brute-force of the 6-digit code.
const MAX_OTP_ATTEMPTS = 5;

const hashOtp = (code) => createHash('sha256').update(String(code)).digest('hex');

// Compare a plaintext code against the stored hash, in constant time.
const safeOtpEqual = (candidate, storedHash) => {
  if (!candidate || !storedHash) {
    return false;
  }
  const candidateHash = Buffer.from(hashOtp(candidate));
  const stored = Buffer.from(String(storedHash));
  if (candidateHash.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(candidateHash, stored);
};

module.exports = { hashOtp, safeOtpEqual, MAX_OTP_ATTEMPTS };
