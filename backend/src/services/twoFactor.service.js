/**
 * Two-factor authentication (TOTP) service: enrollment, confirmation,
 * disabling, and the login-time challenge. Recovery codes are single-use,
 * hashed like every other one-time code in this app (see utils/otp.js).
 * Never touches req/res; functions return data or throw
 * TwoFactorServiceError(code[, message]) for the controller, exactly like
 * every other service in this codebase.
 */

const { randomBytes } = require('crypto');
const db = require('../database');
const mailService = require('./mail.service');
const { verifyUserIdentity } = require('./user.service');
const { encryptSecret, decryptSecret } = require('../utils/encryption');
const { generateTotpSecret, buildOtpauthUrl, matchTotpCode } = require('../utils/totp');
const { hashOtp, safeOtpEqual } = require('../utils/otp');

// How many single-use recovery codes are minted on enrollment: enough that
// losing the authenticator device doesn't strand the user, few enough that
// unused ones don't linger indefinitely.
const RECOVERY_CODE_COUNT = 8;

class TwoFactorServiceError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'TwoFactorServiceError';
    this.code = code;
  }
}

// Recovery codes are longer than the 6-digit OTP codes (this app's other
// one-time codes are short-lived and rate-limited into uselessness for an
// attacker; a recovery code has no expiry, so it needs to resist a much
// larger brute-force budget): 10 bytes, hex-encoded, dashed for readability.
const generateRecoveryCode = () => {
  const raw = randomBytes(10).toString('hex').toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`;
};

// Recovery codes reuse the OTP hashing scheme (SHA-256, constant-time
// compare) rather than bcrypt: they are high-entropy random tokens, not
// low-entropy human-chosen secrets, so there is nothing for a slow KDF to
// protect against that a fast hash doesn't already (a 20-hex-char code has
// far more entropy than any bcrypt work factor meaningfully adds to).
const hashRecoveryCode = (code) => hashOtp(code.toUpperCase());

/** Mints RECOVERY_CODE_COUNT fresh codes and stores only their hashes. */
const storeRecoveryCodes = async (userId) => {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  await db.query('DELETE FROM user_recovery_codes WHERE user_id = ?', [userId]);
  await db.query(
    `INSERT INTO user_recovery_codes (user_id, code_hash) VALUES ${codes.map(() => '(?, ?)').join(', ')}`,
    codes.flatMap((code) => [userId, hashRecoveryCode(code)]),
  );
  return codes;
};

// Starts enrollment: generates a fresh secret, stages it (not yet active) so
// a half-finished setup can never lock a user out of an account that never
// actually got 2FA turned on. Throws 'already_enabled' if 2FA is already on
// (disable it first to re-enroll).
const beginTotpSetup = async (userId) => {
  const [rows] = await db.query('SELECT email, totp_enabled FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) {
    throw new TwoFactorServiceError('not_found', 'User not found.');
  }
  if (rows[0].totp_enabled) {
    throw new TwoFactorServiceError(
      'already_enabled',
      'Two-factor authentication is already enabled.',
    );
  }

  const secret = generateTotpSecret();
  await db.query('UPDATE users SET totp_pending_secret_encrypted = ? WHERE id = ?', [
    encryptSecret(secret),
    userId,
  ]);

  return {
    secret,
    otpauthUrl: buildOtpauthUrl({ secret, accountName: rows[0].email }),
  };
};

// Confirms enrollment: the user must prove they scanned the secret correctly
// by submitting one live code before it becomes the account's real secret.
// On success, mints recovery codes (returned once — see storeRecoveryCodes)
// and sends a security alert. Throws 'no_pending_setup' or 'invalid_code'.
const confirmTotpSetup = async (userId, code, { onMailError } = {}) => {
  const [rows] = await db.query(
    'SELECT email, totp_pending_secret_encrypted FROM users WHERE id = ?',
    [userId],
  );
  if (rows.length === 0 || !rows[0].totp_pending_secret_encrypted) {
    throw new TwoFactorServiceError(
      'no_pending_setup',
      'Start two-factor setup again before confirming.',
    );
  }

  const secret = decryptSecret(rows[0].totp_pending_secret_encrypted);
  const matchedStep = matchTotpCode(secret, code);
  if (matchedStep === null) {
    throw new TwoFactorServiceError('invalid_code', 'Incorrect code.');
  }

  // The confirmation code's time step is recorded as already consumed, so the
  // very code that enabled 2FA can't be replayed at login moments later.
  await db.query(
    'UPDATE users SET totp_secret_encrypted = ?, totp_pending_secret_encrypted = NULL, totp_enabled = true, totp_last_used_step = ? WHERE id = ?',
    [encryptSecret(secret), matchedStep, userId],
  );
  const recoveryCodes = await storeRecoveryCodes(userId);

  // Not awaited: setup is already complete, so the response must not wait on
  // (nor fail with) the send. Mirrors every other security alert in this app.
  Promise.resolve(
    mailService.sendMail({
      to: rows[0].email,
      subject: 'Two-factor authentication was enabled',
      text: 'Two-factor authentication was just turned on for your FrameSet account. If this was not you, reset your password immediately.',
      html: mailService.buildTemplate({
        title: 'Two-factor authentication was enabled',
        message:
          'Two-factor authentication was just turned on for your FrameSet account. If this was not you, reset your password immediately from the login page.',
        footer:
          'You are receiving this security alert because a sign-in method was added to your account.',
      }),
    }),
  ).catch((mailError) => {
    if (onMailError) onMailError(mailError);
  });

  return { recoveryCodes };
};

// Disables 2FA: a critical action, so it requires re-authentication
// (currentPassword or googleCredential), the same pattern as email changes
// and account deletion (see user.service.verifyUserIdentity). Clears the
// secret and every recovery code, and sends a security alert.
const disableTotp = async (
  userId,
  { currentPassword, googleCredential } = {},
  { onMailError } = {},
) => {
  const [rows] = await db.query('SELECT email, password, google_id FROM users WHERE id = ?', [
    userId,
  ]);
  if (rows.length === 0) {
    throw new TwoFactorServiceError('not_found', 'User not found.');
  }
  await verifyUserIdentity(rows[0], { currentPassword, googleCredential });

  await db.query(
    'UPDATE users SET totp_secret_encrypted = NULL, totp_pending_secret_encrypted = NULL, totp_enabled = false, totp_last_used_step = NULL WHERE id = ?',
    [userId],
  );
  await db.query('DELETE FROM user_recovery_codes WHERE user_id = ?', [userId]);

  Promise.resolve(
    mailService.sendMail({
      to: rows[0].email,
      subject: 'Two-factor authentication was disabled',
      text: 'Two-factor authentication was just turned off for your FrameSet account. If this was not you, reset your password immediately.',
      html: mailService.buildTemplate({
        title: 'Two-factor authentication was disabled',
        message:
          'Two-factor authentication was just turned off for your FrameSet account. If this was not you, reset your password immediately from the login page.',
        footer:
          'You are receiving this security alert because a sign-in method was removed from your account.',
      }),
    }),
  ).catch((mailError) => {
    if (onMailError) onMailError(mailError);
  });

  return { success: true };
};

// Marks one unused recovery code as consumed. Scoped to the user and to
// not-yet-used rows, so a code can never be replayed. Returns whether a row
// matched (i.e. the code was valid and unused).
const consumeRecoveryCode = async (userId, code) => {
  const [rows] = await db.query(
    'SELECT id, code_hash FROM user_recovery_codes WHERE user_id = ? AND used_at IS NULL',
    [userId],
  );

  // safeOtpEqual hashes its first argument itself (see utils/otp.js) — pass
  // the normalized plaintext candidate, not a pre-hashed value, or this would
  // compare a hash-of-a-hash against the stored single hash and never match.
  const normalizedCandidate = String(code || '').toUpperCase();
  const match = rows.find((row) => safeOtpEqual(normalizedCandidate, row.code_hash));
  if (!match) {
    return false;
  }

  const [result] = await db.query(
    'UPDATE user_recovery_codes SET used_at = NOW() WHERE id = ? AND used_at IS NULL',
    [match.id],
  );
  return result.affectedRows > 0;
};

// The login-time second factor: called once a password has already checked
// out (see auth.service.authenticateUser's requiresTotp branch). Tries the
// live TOTP code first, then falls back to a recovery code — so losing the
// authenticator device never permanently locks a user out of their own
// account. Throws 'not_enabled' (defensive: should never happen if the
// caller only reaches here via a requiresTotp challenge) or 'invalid_code'.
const verifyTotpChallenge = async (userId, code) => {
  const [rows] = await db.query(
    'SELECT totp_enabled, totp_secret_encrypted, totp_last_used_step FROM users WHERE id = ?',
    [userId],
  );
  if (rows.length === 0 || !rows[0].totp_enabled || !rows[0].totp_secret_encrypted) {
    throw new TwoFactorServiceError('not_enabled', 'Two-factor authentication is not enabled.');
  }

  const secret = decryptSecret(rows[0].totp_secret_encrypted);
  const matchedStep = matchTotpCode(secret, code);
  // Anti-replay (RFC 6238 §5.2): a code is only accepted for a time step
  // strictly newer than the last one consumed, so an intercepted code is
  // worthless even inside its own 30s validity window. The guarded UPDATE
  // makes the claim atomic — two concurrent logins replaying the same code
  // can't both win the race.
  if (matchedStep !== null) {
    const lastUsedStep = rows[0].totp_last_used_step;
    if (lastUsedStep === null || matchedStep > Number(lastUsedStep)) {
      const [result] = await db.query(
        'UPDATE users SET totp_last_used_step = ? WHERE id = ? AND (totp_last_used_step IS NULL OR totp_last_used_step < ?)',
        [matchedStep, userId, matchedStep],
      );
      if (result.affectedRows > 0) {
        return { success: true, usedRecoveryCode: false };
      }
    }
    throw new TwoFactorServiceError('invalid_code', 'Incorrect code.');
  }

  if (await consumeRecoveryCode(userId, code)) {
    return { success: true, usedRecoveryCode: true };
  }

  throw new TwoFactorServiceError('invalid_code', 'Incorrect code.');
};

module.exports = {
  TwoFactorServiceError,
  RECOVERY_CODE_COUNT,
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
  verifyTotpChallenge,
};
