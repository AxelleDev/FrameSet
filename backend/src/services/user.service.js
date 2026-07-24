/**
 * User service: business logic and SQL for the account lifecycle (profile read/update,
 * password change, deletion, and the pending-email change flow). Never touches req/res;
 * functions return data or throw UserServiceError(code[, message]) for the controller.
 */

const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../database');
const mailService = require('./mail.service');
const { generateVerificationCode } = require('../utils/auth.utils');
const {
  BCRYPT_SALT_ROUNDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_COMPLEXITY_REGEX,
} = require('../config/security.config');
const { hashOtp, safeOtpEqual } = require('../utils/otp');
const { registerFailedOtpAttempt } = require('./auth.service');
const { verifyGoogleIdToken } = require('./googleIdentity.service');

// Thrown to signal a business/validation failure. The controller maps `code` to an
// HTTP status; `message`, when present, is surfaced to the client unchanged.
class UserServiceError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'UserServiceError';
    this.code = code;
  }
}

// Confirms the requester's identity before a critical action (email change,
// account deletion): a stolen or unattended session alone must not be enough.
// Accounts with a password confirm with it; Google-only accounts confirm with a
// fresh Google sign-in whose stable id must match the linked one. `userDb` must
// carry the `password` and `google_id` columns.
const verifyUserIdentity = async (userDb, { currentPassword, googleCredential } = {}) => {
  if (userDb.password) {
    if (typeof currentPassword !== 'string' || validator.trim(currentPassword) === '') {
      throw new UserServiceError(
        'reauth_required',
        'Please confirm your current password to continue.',
      );
    }
    const isMatch = await bcrypt.compare(validator.trim(currentPassword), userDb.password);
    if (!isMatch) {
      throw new UserServiceError('invalid_current_password', 'Current password is incorrect.');
    }
    return;
  }

  if (userDb.google_id) {
    if (typeof googleCredential !== 'string' || googleCredential.trim() === '') {
      throw new UserServiceError(
        'reauth_required',
        'Please confirm your identity with Google to continue.',
      );
    }
    const verification = await verifyGoogleIdToken(googleCredential);
    if (verification.status !== 'ok' || verification.googleId !== userDb.google_id) {
      throw new UserServiceError('reauth_failed', 'Google verification failed. Please try again.');
    }
    return;
  }

  // An account with neither a password nor a linked Google identity should not
  // exist; fail closed rather than allow the action.
  throw new UserServiceError('reauth_required', 'Please confirm your identity to continue.');
};

// Total number of registered users (public stat shown on the landing page).
const getUserCount = async () => {
  const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
  return rows[0].count;
};

// The user's profile: only non-sensitive columns (never the password hash —
// `password IS NOT NULL` only says whether a local password exists, so the UI
// can adapt for Google-only accounts).
const getUserProfile = async (userId) => {
  const [rows] = await db.query(
    'SELECT id, name, email, avatar_initials, password_updated_at, pending_email, is_demo, (password IS NOT NULL) AS has_password FROM users WHERE id = ?',
    [userId],
  );

  if (rows.length === 0) {
    throw new UserServiceError('not_found', 'User not found.');
  }

  const userDb = rows[0];
  return {
    id: userDb.id,
    name: userDb.name,
    email: userDb.email,
    avatarInitials: userDb.avatar_initials,
    passwordUpdatedAt: userDb.password_updated_at,
    pendingEmail: userDb.pending_email || null,
    hasPassword: Boolean(userDb.has_password),
    isDemo: Boolean(userDb.is_demo),
  };
};

// Update the profile. A name change applies immediately; an email change is staged as
// a pending email confirmed via a one-time code (see confirmPendingEmail), proving
// ownership and preventing account takeover through an unverified email swap.
// Changing the email is a critical action: it additionally requires re-authentication
// (currentPassword or googleCredential) — see verifyUserIdentity.
// A failed code send is reported via onMailError, not thrown: the pending email is
// already staged and the user can use "resend", so it must not surface as a 500.
const updateUserProfile = async (
  userId,
  { name, email, currentPassword, googleCredential },
  { onMailError } = {},
) => {
  if (!name || !email) {
    throw new UserServiceError('validation', 'All fields are required.');
  }
  const trimmedName = validator.trim(name);
  const trimmedEmail = validator.trim(email);
  if (!validator.isEmail(trimmedEmail)) {
    throw new UserServiceError('validation', 'Invalid email.');
  }

  const [rows] = await db.query(
    'SELECT email, pending_email, password, google_id FROM users WHERE id = ?',
    [userId],
  );
  if (rows.length === 0) {
    throw new UserServiceError('not_found', 'User not found.');
  }

  const currentEmail = rows[0].email;
  const isEmailChanged = trimmedEmail !== currentEmail;

  if (isEmailChanged) {
    // Re-authenticate before anything else (even the availability check), so an
    // attacker holding only a session can neither change the email nor probe
    // which addresses are taken.
    await verifyUserIdentity(rows[0], { currentPassword, googleCredential });

    const [existing] = await db.query(
      'SELECT id FROM users WHERE (email = ? OR pending_email = ?) AND id <> ?',
      [trimmedEmail, trimmedEmail, userId],
    );
    if (existing.length > 0) {
      throw new UserServiceError('email_in_use', 'This email is already in use.');
    }

    const { code: pendingCode, expires } = generateVerificationCode();

    await db.query(
      'UPDATE users SET name = ?, pending_email = ?, pending_email_code = ?, pending_email_expires = ?, otp_attempts = 0 WHERE id = ?',
      [trimmedName, trimmedEmail, hashOtp(pendingCode), expires, userId],
    );

    try {
      await mailService.sendMail({
        to: trimmedEmail,
        subject: 'Confirm your new email',
        text: `Your confirmation code is: ${pendingCode}\nThis code expires in 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'Confirm your new email',
          message: 'Use the code below to confirm your new email.',
          code: pendingCode,
        }),
      });
    } catch (mailError) {
      if (onMailError) onMailError(mailError);
    }

    return { name: trimmedName, email: currentEmail, pendingEmail: trimmedEmail };
  }

  await db.query('UPDATE users SET name = ? WHERE id = ?', [trimmedName, userId]);
  return { name: trimmedName, email: currentEmail, pendingEmail: rows[0].pending_email || null };
};

// Confirm a pending email change: validate the one-time code/expiry, then atomically
// promote pending_email to the account email and clear the pending fields.
// On success a security alert is sent to the PREVIOUS address (not awaited), so the
// legitimate owner learns about a change they did not initiate.
const confirmPendingEmail = async (userId, { email, code }, { onMailError } = {}) => {
  const [rows] = await db.query(
    'SELECT id, name, email, avatar_initials, password_updated_at, pending_email_code, pending_email_expires, otp_attempts FROM users WHERE id = ? AND pending_email = ?',
    [userId, email],
  );
  if (rows.length === 0) {
    throw new UserServiceError('no_pending', 'No pending email found.');
  }
  const userDb = rows[0];
  if (!userDb.pending_email_code || !safeOtpEqual(code, userDb.pending_email_code)) {
    await registerFailedOtpAttempt(userDb, 'pending_email_code');
    throw new UserServiceError('invalid_code', 'Incorrect code.');
  }
  if (!userDb.pending_email_expires || new Date() > new Date(userDb.pending_email_expires)) {
    throw new UserServiceError('code_expired', 'Code expired. Please request a new one.');
  }

  try {
    await db.query(
      'UPDATE users SET email = pending_email, pending_email = NULL, pending_email_code = NULL, pending_email_expires = NULL, otp_attempts = 0 WHERE id = ?',
      [userDb.id],
    );
  } catch (error) {
    // The address was taken by another account between staging and confirmation:
    // surface a clean 400 and clear the now-unusable pending fields.
    if (error.code === 'ER_DUP_ENTRY') {
      await db.query(
        'UPDATE users SET pending_email = NULL, pending_email_code = NULL, pending_email_expires = NULL, otp_attempts = 0 WHERE id = ?',
        [userDb.id],
      );
      throw new UserServiceError('email_in_use', 'This email is already in use.');
    }
    throw error;
  }

  // Security alert to the previous address: if the change was not initiated by
  // the owner, this is their signal to react. Not awaited so a slow/failing
  // SMTP can't delay or fail the response.
  Promise.resolve(
    mailService.sendMail({
      to: userDb.email,
      subject: 'Your account email was changed',
      text: 'The email address on your FrameSet account was just changed. If this was not you, reset your password immediately.',
      html: mailService.buildTemplate({
        title: 'Your account email was changed',
        message:
          'The email address on your FrameSet account was just changed. If this was not you, reset your password immediately from the login page.',
        footer:
          'You are receiving this security alert at your previous address because the account email was updated.',
      }),
    }),
  ).catch((mailError) => {
    if (onMailError) onMailError(mailError);
  });

  return {
    id: userDb.id,
    name: userDb.name,
    email,
    avatarInitials: userDb.avatar_initials,
    passwordUpdatedAt: userDb.password_updated_at,
    pendingEmail: null,
  };
};

// Regenerate and re-send the confirmation code for a pending email change.
const resendPendingEmail = async (userId, { email }) => {
  const [rows] = await db.query('SELECT id FROM users WHERE id = ? AND pending_email = ?', [
    userId,
    email,
  ]);
  if (rows.length === 0) {
    throw new UserServiceError('no_pending', 'No pending email found.');
  }
  const userDb = rows[0];
  const { code: newCode, expires } = generateVerificationCode();

  await db.query(
    'UPDATE users SET pending_email_code = ?, pending_email_expires = ?, otp_attempts = 0 WHERE id = ?',
    [hashOtp(newCode), expires, userDb.id],
  );

  await mailService.sendMail({
    to: email,
    subject: 'New confirmation code',
    text: `Your new confirmation code is: ${newCode}\nThis code expires in 10 minutes.`,
    html: mailService.buildTemplate({
      title: 'New confirmation code',
      message: 'Here is your new code to confirm your email.',
      code: newCode,
    }),
  });
};

// Change the password. Re-verifies the current password with bcrypt (defense against a
// hijacked session), stores a fresh hash and bumps password_updated_at. Returns the new
// password_updated_at timestamp; the controller re-issues the session cookies.
// On success a security alert is emailed (not awaited); onMailError reports a send failure.
const changeUserPassword = async (
  userId,
  { currentPassword, newPassword },
  { onMailError } = {},
) => {
  if (!currentPassword || !newPassword) {
    throw new UserServiceError('validation', 'Required fields are missing.');
  }
  // Guard against non-string bodies (e.g. a JSON object/array): bcrypt.compare and
  // validator.trim throw on non-strings, which would surface as a 500 instead of 400.
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw new UserServiceError('validation', 'Required fields are missing.');
  }
  const trimmedNewPassword = validator.trim(newPassword);
  if (!validator.isLength(trimmedNewPassword, { min: PASSWORD_MIN_LENGTH })) {
    throw new UserServiceError('validation', 'Password too short.');
  }
  if (!validator.matches(trimmedNewPassword, PASSWORD_COMPLEXITY_REGEX)) {
    throw new UserServiceError(
      'validation',
      'The password must contain at least one uppercase letter, one lowercase letter, and one digit.',
    );
  }

  const [rows] = await db.query('SELECT email, password FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) {
    throw new UserServiceError('not_found', 'User not found.');
  }
  // Google-only account: there is no current password to verify. Creating one
  // goes through the password-reset flow, which proves email ownership instead.
  if (!rows[0].password) {
    throw new UserServiceError(
      'no_password',
      'This account uses Google sign-in and has no password. Use "Forgot password" from the sign-in page to create one.',
    );
  }
  // Trimmed like register/login store and compare it, so a stray space doesn't
  // make a password that still works at login fail here.
  const isMatch = await bcrypt.compare(validator.trim(currentPassword), rows[0].password);
  if (!isMatch) {
    throw new UserServiceError('invalid_current_password', 'Current password is incorrect.');
  }
  const hashedPassword = await bcrypt.hash(trimmedNewPassword, BCRYPT_SALT_ROUNDS);
  await db.query('UPDATE users SET password = ?, password_updated_at = NOW() WHERE id = ?', [
    hashedPassword,
    userId,
  ]);

  // Security alert: the account holder must learn about a password change they
  // did not initiate. Not awaited so a slow/failing SMTP can't delay the response.
  Promise.resolve(
    mailService.sendMail({
      to: rows[0].email,
      subject: 'Your password was changed',
      text: 'Your FrameSet password was just changed. If this was not you, reset your password immediately.',
      html: mailService.buildTemplate({
        title: 'Your password was changed',
        message:
          'Your FrameSet password was just changed from your account settings. If this was not you, reset your password immediately from the login page.',
        footer:
          'You are receiving this security alert because the password on your account was updated.',
      }),
    }),
  ).catch((mailError) => {
    if (onMailError) onMailError(mailError);
  });

  return { passwordUpdatedAt: new Date() };
};

// Permanently delete the user's own account (scoped to the verified id); related project
// data is removed by cascading foreign keys. Destruction is a critical action:
// it requires re-authentication (currentPassword or googleCredential).
const deleteUserAccount = async (userId, { currentPassword, googleCredential } = {}) => {
  const [rows] = await db.query('SELECT password, google_id FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) {
    throw new UserServiceError('not_found', 'User not found.');
  }
  await verifyUserIdentity(rows[0], { currentPassword, googleCredential });

  const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);
  if (result.affectedRows === 0) {
    throw new UserServiceError('not_found', 'User not found.');
  }
};

module.exports = {
  UserServiceError,
  getUserCount,
  getUserProfile,
  updateUserProfile,
  confirmPendingEmail,
  resendPendingEmail,
  changeUserPassword,
  deleteUserAccount,
};
