/**
 * Auth service: business logic and SQL for the auth lifecycle.
 * Functions return data or throw AuthServiceError(code[, message]); HTTP concerns stay in the controller.
 */

const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../database');
const mailService = require('./mail.service');
const { generateVerificationCode, getInitials } = require('../utils/auth.utils');
const { isTokenStaleByPasswordChange } = require('./token.service');
const { hashOtp, safeOtpEqual, MAX_OTP_ATTEMPTS } = require('../utils/otp');
const {
  BCRYPT_SALT_ROUNDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_COMPLEXITY_REGEX,
} = require('../config/security.config');
const { verifyGoogleIdToken } = require('./googleIdentity.service');

// Records a wrong one-time-code attempt on the account and, once MAX_OTP_ATTEMPTS
// is reached, invalidates the stored code (clears `codeColumn`) so it can't be
// brute-forced further. The counter is incremented in SQL (not read-modify-write)
// so concurrent wrong attempts can't race each other past the limit.
// `codeColumn` is an internal constant, never user input.
const registerFailedOtpAttempt = async (userDb, codeColumn) => {
  await db.query('UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?', [userDb.id]);
  await db.query(
    `UPDATE users SET ${codeColumn} = NULL, otp_attempts = 0 WHERE id = ? AND otp_attempts >= ?`,
    [userDb.id, MAX_OTP_ATTEMPTS],
  );
};

/** Coerces a value to a trimmed string, treating null/undefined as empty. */
const normalizeInput = (value) => validator.trim(String(value ?? ''));

// Lazily computed bcrypt hash compared against when a login email has no account,
// so the unknown-email path costs the same as a real password check: without it,
// the fast no-bcrypt response would reveal by timing which emails are registered.
let dummyPasswordHashPromise = null;
const getDummyPasswordHash = () => {
  if (!dummyPasswordHashPromise) {
    dummyPasswordHashPromise = bcrypt.hash('frameset-timing-equalizer', BCRYPT_SALT_ROUNDS);
  }
  return dummyPasswordHashPromise;
};

// Thrown to signal a business/validation failure. The controller maps `code` to
// an HTTP status; `message`, when present, is surfaced to the client unchanged.
class AuthServiceError extends Error {
  constructor(code, message, userId = null) {
    super(message || code);
    this.name = 'AuthServiceError';
    this.code = code;
    this.userId = userId;
  }
}

// Registers a user: validates, enforces the password policy, stores the account
// unverified with a one-time code, and emails it. Throws 'validation' on bad
// input and 'duplicate_email' when the email already exists.
const registerUser = async (
  { name: rawName, email: rawEmail, password: rawPassword },
  { onMailError } = {},
) => {
  const name = normalizeInput(rawName);
  const email = normalizeInput(rawEmail);
  const password = normalizeInput(rawPassword);

  if (!name || !email || !password) {
    throw new AuthServiceError('validation', 'All fields are required.');
  }

  // Bound the name to the column width so an over-long value is a clean 400, not a
  // MySQL ER_DATA_TOO_LONG surfacing as a generic 500.
  if (!validator.isLength(name, { max: 255 })) {
    throw new AuthServiceError('validation', 'Username is too long.');
  }
  if (!validator.isEmail(email)) {
    throw new AuthServiceError('validation', 'Invalid email.');
  }
  if (!validator.isLength(password, { min: PASSWORD_MIN_LENGTH })) {
    throw new AuthServiceError('validation', 'Password too short.');
  }
  if (!validator.matches(password, PASSWORD_COMPLEXITY_REGEX)) {
    throw new AuthServiceError(
      'validation',
      'The password must contain at least one uppercase letter, one lowercase letter, and one digit.',
    );
  }

  const initials = getInitials(name);
  const { code: verificationCode, expires } = generateVerificationCode();

  try {
    // Hash with the configured bcrypt cost factor; never store plaintext.
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const now = new Date();

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, avatar_initials, is_verified, verification_code, verification_code_expires, password_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, initials, false, hashOtp(verificationCode), expires, now],
    );

    try {
      await mailService.sendMail({
        to: email,
        subject: 'Confirm your registration',
        text: `Your confirmation code is: ${verificationCode}\nThis code expires in 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'Confirm your registration',
          message: 'Use the code below to confirm your email address.',
          code: verificationCode,
        }),
      });
    } catch (mailError) {
      // The account is already created; a failed send must not 500 the user (which
      // would strand them on a "duplicate email" retry). Report it and let them use
      // resend-code. Mirrors startPasswordReset's onMailError contract.
      if (onMailError) onMailError(mailError);
    }

    return {
      email,
      user: {
        id: result.insertId,
        name,
        email,
        avatarInitials: initials,
        isVerified: false,
        passwordUpdatedAt: now,
      },
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AuthServiceError('duplicate_email');
    }
    throw error;
  }
};

// Authenticates by email/password: rejects unverified accounts, compares against
// the bcrypt hash. Throws 'missing_credentials', 'invalid_email_format',
// 'invalid_credentials', or 'not_verified'.
const authenticateUser = async ({ email: rawEmail, password: rawPassword }) => {
  let email = rawEmail;
  let password = rawPassword;

  if (!email || !password) {
    throw new AuthServiceError('missing_credentials', 'All fields are required.');
  }

  email = validator.trim(email);
  password = validator.trim(password);

  if (!validator.isEmail(email)) {
    throw new AuthServiceError('invalid_email_format', 'Invalid email.');
  }

  const [rows] = await db.query(
    'SELECT id, name, email, avatar_initials, password_updated_at, pending_email, is_verified, password FROM users WHERE email = ?',
    [email],
  );
  if (rows.length === 0) {
    // Burn the same bcrypt cost as a real comparison so an unknown email is not
    // distinguishable from a wrong password by response time.
    await bcrypt.compare(password, await getDummyPasswordHash());
    throw new AuthServiceError('invalid_credentials');
  }

  const userDb = rows[0];
  if (!userDb.is_verified) {
    throw new AuthServiceError('not_verified', null, userDb.id);
  }

  // Google-only account (no local password): point the user to the right flow
  // instead of a misleading "incorrect password".
  if (!userDb.password) {
    throw new AuthServiceError('google_account', null, userDb.id);
  }

  const isMatch = await bcrypt.compare(password, userDb.password);
  if (!isMatch) {
    throw new AuthServiceError('invalid_credentials', null, userDb.id);
  }

  return {
    id: userDb.id,
    name: userDb.name,
    email: userDb.email,
    avatarInitials: userDb.avatar_initials,
    passwordUpdatedAt: userDb.password_updated_at,
    pendingEmail: userDb.pending_email,
    hasPassword: true,
  };
};

// Columns returned to build a session user; `password IS NOT NULL` exposes
// whether a local password exists without ever selecting the hash itself.
const SESSION_USER_COLUMNS =
  'id, name, email, avatar_initials, password_updated_at, pending_email, is_demo, (password IS NOT NULL) AS has_password';

/** Maps a users row (SESSION_USER_COLUMNS) to the session-user shape. */
const toSessionUser = (userDb) => ({
  id: userDb.id,
  name: userDb.name,
  email: userDb.email,
  avatarInitials: userDb.avatar_initials,
  passwordUpdatedAt: userDb.password_updated_at,
  pendingEmail: userDb.pending_email || null,
  hasPassword: Boolean(userDb.has_password),
  isDemo: Boolean(userDb.is_demo),
});

// Logs into the single shared, read-only demo account (see migration 019) —
// no credentials needed, this is the "Try without an account" entry point.
// Writes for this account are rejected server-side (authenticateToken.js),
// never relying on the client to respect isDemo.
const loginAsDemo = async () => {
  const [rows] = await db.query(
    `SELECT ${SESSION_USER_COLUMNS} FROM users WHERE is_demo = 1 LIMIT 1`,
  );
  if (rows.length === 0) {
    throw new AuthServiceError('demo_unavailable', 'The demo account is not available.');
  }

  return toSessionUser(rows[0]);
};

// Authenticates with a Google ID token (credential from Google Identity Services).
// The token is verified cryptographically against Google's keys and our client id;
// only then is the identity trusted. Resolution order:
//   1. google_id (Google's stable "sub") — survives email changes on either side;
//   2. same Google-verified email — links Google to the existing account (with a
//      security alert email, via onMailError on failure) and marks it verified;
//   3. otherwise a new, already-verified account is created without a password.
// Throws 'google_not_configured', 'validation', 'invalid_google_token' or
// 'google_email_not_verified'.
const authenticateWithGoogle = async (rawCredential, { onMailError } = {}) => {
  const verification = await verifyGoogleIdToken(rawCredential);
  if (verification.status === 'not_configured') {
    throw new AuthServiceError('google_not_configured');
  }
  if (verification.status === 'missing') {
    throw new AuthServiceError('validation', 'Missing Google credential.');
  }
  // Only trust addresses Google itself has verified: linking by an unverified
  // email would let an attacker claim someone else's account.
  if (verification.status === 'email_not_verified') {
    throw new AuthServiceError('google_email_not_verified');
  }
  if (verification.status !== 'ok') {
    throw new AuthServiceError('invalid_google_token');
  }

  const { googleId } = verification;
  const email = normalizeInput(verification.email);
  if (!validator.isEmail(email)) {
    throw new AuthServiceError('invalid_google_token');
  }

  // 1) Known Google identity.
  const [byGoogleId] = await db.query(
    `SELECT ${SESSION_USER_COLUMNS} FROM users WHERE google_id = ?`,
    [googleId],
  );
  if (byGoogleId.length > 0) {
    return toSessionUser(byGoogleId[0]);
  }

  // 2) Existing account with the same Google-verified email: link it. The email
  // is proven owned by this Google user, which also settles any pending local
  // verification. google_id is only set when free so an already-linked account
  // is never silently re-linked to a different Google identity.
  const [byEmail] = await db.query(`SELECT ${SESSION_USER_COLUMNS} FROM users WHERE email = ?`, [
    email,
  ]);
  if (byEmail.length > 0) {
    const userDb = byEmail[0];
    await db.query(
      'UPDATE users SET google_id = ?, is_verified = true, verification_code = NULL, verification_code_expires = NULL WHERE id = ? AND google_id IS NULL',
      [googleId, userDb.id],
    );

    // Security alert: the owner must learn that Google sign-in was attached to
    // their account. Not awaited so a slow/failing SMTP can't delay the response.
    Promise.resolve(
      mailService.sendMail({
        to: userDb.email,
        subject: 'Google sign-in was added to your account',
        text: 'Google sign-in was just linked to your FrameSet account. If this was not you, reset your password immediately.',
        html: mailService.buildTemplate({
          title: 'Google sign-in was added to your account',
          message:
            'Your FrameSet account can now be accessed with Google sign-in. If this was not you, reset your password immediately from the login page.',
          footer:
            'You are receiving this security alert because a sign-in method was added to your account.',
        }),
      }),
    ).catch((mailError) => {
      if (onMailError) onMailError(mailError);
    });

    return toSessionUser(userDb);
  }

  // 3) First sign-in: create an already-verified, passwordless account.
  // password_updated_at stays NULL (no password has ever existed), which also
  // keeps the token-staleness check inert until a password is created.
  const name = (normalizeInput(verification.name) || email.split('@')[0]).slice(0, 255);
  const initials = getInitials(name);
  try {
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, avatar_initials, is_verified, google_id, password_updated_at) VALUES (?, ?, NULL, ?, true, ?, NULL)',
      [name, email, initials, googleId],
    );

    return {
      id: result.insertId,
      name,
      email,
      avatarInitials: initials,
      passwordUpdatedAt: null,
      pendingEmail: null,
      hasPassword: false,
    };
  } catch (error) {
    // Two concurrent first sign-ins raced on the unique keys: the account now
    // exists, so read it back instead of failing.
    if (error.code === 'ER_DUP_ENTRY') {
      const [retry] = await db.query(
        `SELECT ${SESSION_USER_COLUMNS} FROM users WHERE google_id = ? OR email = ?`,
        [googleId, email],
      );
      if (retry.length > 0) {
        return toSessionUser(retry[0]);
      }
    }
    throw error;
  }
};

// Wraps token.service.isTokenStaleByPasswordChange so the controller needn't
// import it directly. issuedAt is the token's "iat" claim, in seconds.
const isRefreshTokenStale = (userId, issuedAt) => isTokenStaleByPasswordChange(userId, issuedAt);

// Confirms a registration email via the one-time code, then clears the code so
// it can't be reused. Every invalid case throws 'validation'.
const verifyEmailCode = async ({ email, code }) => {
  if (!email || !code) {
    throw new AuthServiceError('validation', 'Email and code are required.');
  }
  if (!validator.isEmail(validator.trim(String(email)))) {
    throw new AuthServiceError('validation', 'Invalid email.');
  }

  const normalizedEmail = validator.trim(String(email));
  const [rows] = await db.query(
    'SELECT id, is_verified, verification_code, verification_code_expires, otp_attempts FROM users WHERE email = ?',
    [normalizedEmail],
  );
  // Anti-enumeration: a missing account and an already-verified one are made
  // indistinguishable from a wrong code (same generic error).
  if (rows.length === 0) {
    throw new AuthServiceError('validation', 'Incorrect code.');
  }
  const userDb = rows[0];
  if (userDb.is_verified) {
    throw new AuthServiceError('validation', 'Incorrect code.');
  }
  if (!userDb.verification_code || !safeOtpEqual(code, userDb.verification_code)) {
    await registerFailedOtpAttempt(userDb, 'verification_code');
    throw new AuthServiceError('validation', 'Incorrect code.');
  }
  if (
    !userDb.verification_code_expires ||
    new Date() > new Date(userDb.verification_code_expires)
  ) {
    throw new AuthServiceError('validation', 'Code expired. Please request a new one.');
  }
  await db.query(
    'UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL, otp_attempts = 0 WHERE email = ?',
    [normalizedEmail],
  );
  return { success: true };
};

// Regenerates and re-sends the verification code for an unverified account,
// replacing any previous code. Every invalid case throws 'validation'.
const resendVerificationCode = async ({ email }) => {
  if (!email) {
    throw new AuthServiceError('validation', 'Email is required.');
  }
  if (!validator.isEmail(validator.trim(String(email)))) {
    throw new AuthServiceError('validation', 'Invalid email.');
  }

  const normalizedEmail = validator.trim(String(email));
  const [rows] = await db.query('SELECT id, is_verified FROM users WHERE email = ?', [
    normalizedEmail,
  ]);

  // Anti-enumeration: only send when an unverified account actually exists, but
  // always return the same generic response so the caller can't tell.
  if (rows.length > 0 && !rows[0].is_verified) {
    const { code: newCode, expires } = generateVerificationCode();
    await db.query(
      'UPDATE users SET verification_code = ?, verification_code_expires = ?, otp_attempts = 0 WHERE email = ?',
      [hashOtp(newCode), expires, normalizedEmail],
    );
    // Not awaited: an SMTP round-trip only happens for existing accounts, so a
    // blocking send would reveal by response time which emails are registered.
    // Send failures are swallowed to keep the response generic (the code is stored).
    Promise.resolve(
      mailService.sendMail({
        to: normalizedEmail,
        subject: 'New verification code',
        text: `Your new verification code is: ${newCode}\nThis code expires in 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'New verification code',
          message: 'Here is your new verification code.',
          code: newCode,
        }),
      }),
    ).catch(() => {});
  }

  return { success: true };
};

// Starts "forgot password": if the email matches an account, stores a one-time
// reset code and emails it. Behaves identically whether or not the email exists,
// to avoid revealing which emails are registered. onMailError lets the
// controller log a send failure without changing the response.
const startPasswordReset = async ({ email: rawEmail }, { onMailError } = {}) => {
  const email = normalizeInput(rawEmail);
  if (!email) {
    throw new AuthServiceError('validation', 'Email is required.');
  }
  if (!validator.isEmail(email)) {
    throw new AuthServiceError('validation', 'Invalid email.');
  }

  const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

  if (rows.length > 0) {
    const { code, expires } = generateVerificationCode();
    await db.query(
      'UPDATE users SET reset_code = ?, reset_code_expires = ?, otp_attempts = 0 WHERE email = ?',
      [hashOtp(code), expires, email],
    );

    // Not awaited: an SMTP round-trip only happens for existing accounts, so a
    // blocking send would reveal by response time which emails are registered.
    // A send failure is reported via onMailError; the stored code stays valid.
    Promise.resolve(
      mailService.sendMail({
        to: email,
        subject: 'Reset your password',
        text: `Your reset code is: ${code}\nThis code expires in 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'Reset your password',
          message: 'Use the code below to choose a new password.',
          code,
        }),
      }),
    ).catch((mailError) => {
      if (onMailError) onMailError(mailError);
    });
  }
};

// Completes "forgot password": validates the reset code and password policy,
// stores the new password, and clears the code. A missing account returns the
// same generic "Incorrect code" error to avoid user enumeration. Throws 'validation'.
// On success a security alert is emailed (not awaited); onMailError reports a send failure.
const completePasswordReset = async (
  { email: rawEmail, code: rawCode, newPassword },
  { onMailError } = {},
) => {
  const email = normalizeInput(rawEmail);
  const code = normalizeInput(rawCode);
  const password = normalizeInput(newPassword);

  if (!email || !code || !password) {
    throw new AuthServiceError('validation', 'Email, code, and new password are required.');
  }
  if (!validator.isEmail(email)) {
    throw new AuthServiceError('validation', 'Invalid email.');
  }
  if (!validator.isLength(password, { min: PASSWORD_MIN_LENGTH })) {
    throw new AuthServiceError('validation', 'Password too short.');
  }
  if (!validator.matches(password, PASSWORD_COMPLEXITY_REGEX)) {
    throw new AuthServiceError(
      'validation',
      'The password must contain at least one uppercase letter, one lowercase letter, and one digit.',
    );
  }

  const [rows] = await db.query(
    'SELECT id, reset_code, reset_code_expires, otp_attempts FROM users WHERE email = ?',
    [email],
  );
  if (rows.length === 0) {
    throw new AuthServiceError('validation', 'Incorrect code.');
  }

  const userDb = rows[0];
  if (!userDb.reset_code || !safeOtpEqual(code, userDb.reset_code)) {
    await registerFailedOtpAttempt(userDb, 'reset_code');
    throw new AuthServiceError('validation', 'Incorrect code.');
  }
  if (!userDb.reset_code_expires || new Date() > new Date(userDb.reset_code_expires)) {
    throw new AuthServiceError('validation', 'Code expired. Please request a new one.');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  await db.query(
    'UPDATE users SET password = ?, password_updated_at = NOW(), reset_code = NULL, reset_code_expires = NULL, otp_attempts = 0 WHERE email = ?',
    [hashedPassword, email],
  );

  // Security alert: the account holder must learn about a password change they
  // did not initiate. Not awaited so a slow/failing SMTP can't delay the response.
  Promise.resolve(
    mailService.sendMail({
      to: email,
      subject: 'Your password was changed',
      text: 'Your FrameSet password was just changed using a reset code. If this was not you, reset your password immediately.',
      html: mailService.buildTemplate({
        title: 'Your password was changed',
        message:
          'Your FrameSet password was just changed using a reset code. If this was not you, reset your password immediately from the login page.',
        footer:
          'You are receiving this security alert because the password on your account was updated.',
      }),
    }),
  ).catch((mailError) => {
    if (onMailError) onMailError(mailError);
  });

  return { success: true };
};

module.exports = {
  AuthServiceError,
  registerFailedOtpAttempt,
  registerUser,
  authenticateUser,
  authenticateWithGoogle,
  loginAsDemo,
  isRefreshTokenStale,
  verifyEmailCode,
  resendVerificationCode,
  startPasswordReset,
  completePasswordReset,
};
