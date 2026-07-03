/**
 * User account controller: profile read/update, password change, deletion, and the
 * pending-email change flow. All mutating ops are scoped to the authenticated user id.
 */

const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../database');
const mailService = require('../services/mail.service');
const { getAuthenticatedUserId, generateVerificationCode, createControllerLogger } = require('../utils/auth.utils');
const { BCRYPT_SALT_ROUNDS, PASSWORD_MIN_LENGTH, PASSWORD_COMPLEXITY_REGEX } = require('../config/security.config');
const { issueAuthCookies } = require('../utils/session.utils');
const { hashOtp, safeOtpEqual } = require('../utils/otp');
const { registerFailedOtpAttempt } = require('../services/auth.service');

const logUserControllerError = createControllerLogger('users');

// Return the total number of registered users (public stat).
const getUserCount = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
    res.json({ count: rows[0].count });
  } catch (error) {
    logUserControllerError(req, 'count', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// Return the user's profile: only non-sensitive columns (never the password hash),
// id resolved from the verified token rather than any client-supplied value.
const getProfile = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, name, email, avatar_initials, password_updated_at, pending_email FROM users WHERE id = ?',
      [authenticatedUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userDb = rows[0];
    return res.json({
      id: userDb.id,
      name: userDb.name,
      email: userDb.email,
      avatarInitials: userDb.avatar_initials,
      passwordUpdatedAt: userDb.password_updated_at,
      pendingEmail: userDb.pending_email || null
    });
  } catch (error) {
    logUserControllerError(req, 'profile', error);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// Update the user's profile. Name changes apply immediately; an email change is staged
// as a pending email confirmed via a one-time code (see verifyPendingEmail), which proves
// ownership and prevents account takeover via an unverified email swap.
const updateUser = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const { name, email } = req.body;
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  if (!name || !email) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const trimmedName = validator.trim(name);
  const trimmedEmail = validator.trim(email);
  if (!validator.isEmail(trimmedEmail)) {
    return res.status(400).json({ error: 'Invalid email.' });
  }
  try {
    const [rows] = await db.query('SELECT email, pending_email FROM users WHERE id = ?', [authenticatedUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentEmail = rows[0].email;
    const isEmailChanged = trimmedEmail !== currentEmail;

    if (isEmailChanged) {
      const [existing] = await db.query(
        'SELECT id FROM users WHERE (email = ? OR pending_email = ?) AND id <> ?',
        [trimmedEmail, trimmedEmail, authenticatedUserId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'This email is already in use.' });
      }

      const { code: pendingCode, expires } = generateVerificationCode();

      await db.query(
        'UPDATE users SET name = ?, pending_email = ?, pending_email_code = ?, pending_email_expires = ?, otp_attempts = 0 WHERE id = ?',
        [trimmedName, trimmedEmail, hashOtp(pendingCode), expires, authenticatedUserId]
      );

      await mailService.sendMail({
        to: trimmedEmail,
        subject: 'Confirm your new email',
        text: `Your confirmation code is: ${pendingCode}\nThis code expires in 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'Confirm your new email',
          message: 'Use the code below to confirm your new email.',
          code: pendingCode
        })
      });

      return res.json({ success: true, name: trimmedName, email: currentEmail, pendingEmail: trimmedEmail });
    }

    await db.query('UPDATE users SET name = ? WHERE id = ?', [trimmedName, authenticatedUserId]);
    res.json({ success: true, name: trimmedName, email: currentEmail, pendingEmail: rows[0].pending_email || null });
  } catch (error) {
    logUserControllerError(req, 'update', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

// Confirm a pending email change: validate the one-time code/expiry, then atomically
// promote pending_email to the account email and clear the pending fields.
const verifyPendingEmail = async (req, res) => {
  const { email, code } = req.body;
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND pending_email = ?', [authenticatedUserId, email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No pending email found.' });
    }
    const userDb = rows[0];
    if (!userDb.pending_email_code || !safeOtpEqual(code, userDb.pending_email_code)) {
      await registerFailedOtpAttempt(userDb, 'pending_email_code');
      return res.status(400).json({ error: 'Incorrect code.' });
    }
    if (!userDb.pending_email_expires || new Date() > new Date(userDb.pending_email_expires)) {
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }

    await db.query(
      'UPDATE users SET email = pending_email, pending_email = NULL, pending_email_code = NULL, pending_email_expires = NULL, otp_attempts = 0 WHERE id = ?',
      [userDb.id]
    );

    const updatedUser = {
      id: userDb.id,
      name: userDb.name,
      email,
      avatarInitials: userDb.avatar_initials,
      passwordUpdatedAt: userDb.password_updated_at,
      pendingEmail: null
    };

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    logUserControllerError(req, 'verify_pending_email', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// Regenerate and re-send the confirmation code for a pending email change.
const resendPendingEmail = async (req, res) => {
  const { email } = req.body;
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND pending_email = ?', [authenticatedUserId, email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No pending email found.' });
    }
    const userDb = rows[0];
    const { code: newCode, expires } = generateVerificationCode();

    await db.query(
      'UPDATE users SET pending_email_code = ?, pending_email_expires = ?, otp_attempts = 0 WHERE id = ?',
      [hashOtp(newCode), expires, userDb.id]
    );

    await mailService.sendMail({
      to: email,
      subject: 'New confirmation code',
      text: `Your new confirmation code is: ${newCode}\nThis code expires in 10 minutes.`,
      html: mailService.buildTemplate({
        title: 'New confirmation code',
        message: 'Here is your new code to confirm your email.',
        code: newCode
      })
    });

    res.json({ success: true });
  } catch (error) {
    logUserControllerError(req, 'resend_pending_email', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// Change the user's password. Re-verifies the current password with bcrypt before
// applying (defense against a hijacked session); stores a fresh hash and bumps
// password_updated_at.
const changePassword = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const { currentPassword, newPassword } = req.body;
  if (!authenticatedUserId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Required fields are missing.' });
  }
  const trimmedNewPassword = validator.trim(newPassword);
  if (!validator.isLength(trimmedNewPassword, { min: PASSWORD_MIN_LENGTH })) {
    return res.status(400).json({ error: 'Password too short.' });
  }
  if (!validator.matches(trimmedNewPassword, PASSWORD_COMPLEXITY_REGEX)) {
    return res.status(400).json({ error: 'The password must contain at least one uppercase letter, one lowercase letter, and one digit.' });
  }
  try {
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [authenticatedUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const hashedPassword = await bcrypt.hash(trimmedNewPassword, BCRYPT_SALT_ROUNDS);
    await db.query('UPDATE users SET password = ?, password_updated_at = NOW() WHERE id = ?', [hashedPassword, authenticatedUserId]);
    // Re-issue a fresh token pair so this session keeps working while every other
    // session (tokens issued before this change) is invalidated.
    issueAuthCookies(res, { id: authenticatedUserId, email: req.user?.email });
    res.json({ success: true, passwordUpdatedAt: new Date() });
  } catch (error) {
    logUserControllerError(req, 'change_password', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// Permanently delete the user's own account (scoped to the verified id); related
// project data is removed by cascading foreign keys.
const deleteAccount = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [authenticatedUserId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    logUserControllerError(req, 'delete_account', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getUserCount,
  getProfile,
  updateUser,
  verifyPendingEmail,
  resendPendingEmail,
  changePassword,
  deleteAccount
};
