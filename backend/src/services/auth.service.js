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
const { BCRYPT_SALT_ROUNDS, PASSWORD_MIN_LENGTH, PASSWORD_COMPLEXITY_REGEX } = require('../config/security.config');

// Records a wrong one-time-code attempt on the account and, once MAX_OTP_ATTEMPTS
// is reached, invalidates the stored code (clears `codeColumn`) so it can't be
// brute-forced further. `codeColumn` is an internal constant, never user input.
const registerFailedOtpAttempt = async (userDb, codeColumn) => {
  const attempts = (userDb.otp_attempts || 0) + 1;
  if (attempts >= MAX_OTP_ATTEMPTS) {
    await db.query(`UPDATE users SET ${codeColumn} = NULL, otp_attempts = 0 WHERE id = ?`, [userDb.id]);
  } else {
    await db.query('UPDATE users SET otp_attempts = ? WHERE id = ?', [attempts, userDb.id]);
  }
};

/** Coerces a value to a trimmed string, treating null/undefined as empty. */
const normalizeInput = (value) => validator.trim(String(value ?? ''));

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
const registerUser = async ({ name: rawName, email: rawEmail, password: rawPassword }) => {
  const name = normalizeInput(rawName);
  const email = normalizeInput(rawEmail);
  const password = normalizeInput(rawPassword);

  if (!name || !email || !password) {
    throw new AuthServiceError('validation', 'All fields are required.');
  }

  if (!validator.isEmail(email)) {
    throw new AuthServiceError('validation', 'Invalid email.');
  }
  if (!validator.isLength(password, { min: PASSWORD_MIN_LENGTH })) {
    throw new AuthServiceError('validation', 'Password too short.');
  }
  if (!validator.matches(password, PASSWORD_COMPLEXITY_REGEX)) {
    throw new AuthServiceError('validation', 'The password must contain at least one uppercase letter, one lowercase letter, and one digit.');
  }

  const initials = getInitials(name);
  const { code: verificationCode, expires } = generateVerificationCode();

  try {
    // Hash with the configured bcrypt cost factor; never store plaintext.
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const now = new Date();

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, avatar_initials, is_verified, verification_code, verification_code_expires, password_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, initials, false, hashOtp(verificationCode), expires, now]
    );

    await mailService.sendMail({
      to: email,
      subject: 'Confirm your registration',
      text: `Your confirmation code is: ${verificationCode}\nThis code expires in 10 minutes.`,
      html: mailService.buildTemplate({
        title: 'Confirm your registration',
        message: 'Use the code below to confirm your email address.',
        code: verificationCode
      })
    });

    return {
      email,
      user: {
        id: result.insertId,
        name,
        email,
        avatarInitials: initials,
        is_verified: false,
        passwordUpdatedAt: now
      }
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

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    throw new AuthServiceError('invalid_credentials');
  }

  const userDb = rows[0];
  if (!userDb.is_verified) {
    throw new AuthServiceError('not_verified', null, userDb.id);
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
    pendingEmail: userDb.pending_email
  };
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

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [validator.trim(String(email))]);
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
  if (!userDb.verification_code_expires || new Date() > new Date(userDb.verification_code_expires)) {
    throw new AuthServiceError('validation', 'Code expired. Please request a new one.');
  }
  await db.query('UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL, otp_attempts = 0 WHERE email = ?', [email]);
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
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

  // Anti-enumeration: only send when an unverified account actually exists, but
  // always return the same generic response so the caller can't tell.
  if (rows.length > 0 && !rows[0].is_verified) {
    const { code: newCode, expires } = generateVerificationCode();
    await db.query(
      'UPDATE users SET verification_code = ?, verification_code_expires = ?, otp_attempts = 0 WHERE email = ?',
      [hashOtp(newCode), expires, normalizedEmail]
    );
    try {
      await mailService.sendMail({
        to: normalizedEmail,
        subject: 'New verification code',
        text: `Your new verification code is: ${newCode}\nThis code expires in 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'New verification code',
          message: 'Here is your new verification code.',
          code: newCode
        })
      });
    } catch {
      // Swallow send failures so the response stays generic (the code is stored).
    }
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
      [hashOtp(code), expires, email]
    );

    try {
      await mailService.sendMail({
        to: email,
        subject: 'Reset your password',
        text: `Your reset code is: ${code}\nThis code expires in 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'Reset your password',
          message: 'Use the code below to choose a new password.',
          code
        })
      });
    } catch (mailError) {
      // Report the send failure but keep the generic response; the stored code stays valid.
      if (onMailError) onMailError(mailError);
    }
  }
};

// Completes "forgot password": validates the reset code and password policy,
// stores the new password, and clears the code. A missing account returns the
// same generic "Incorrect code" error to avoid user enumeration. Throws 'validation'.
const completePasswordReset = async ({ email: rawEmail, code: rawCode, newPassword }) => {
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
    throw new AuthServiceError('validation', 'The password must contain at least one uppercase letter, one lowercase letter, and one digit.');
  }

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
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
    [hashedPassword, email]
  );

  return { success: true };
};

module.exports = {
  AuthServiceError,
  registerFailedOtpAttempt,
  registerUser,
  authenticateUser,
  isRefreshTokenStale,
  verifyEmailCode,
  resendVerificationCode,
  startPasswordReset,
  completePasswordReset
};
