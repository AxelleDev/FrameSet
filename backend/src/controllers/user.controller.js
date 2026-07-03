/**
 * User account controller: thin HTTP layer for the account lifecycle (profile
 * read/update, password change, deletion, pending-email flow). Business logic and
 * SQL live in user.service; all mutating ops are scoped to the authenticated user id.
 */

const userService = require('../services/user.service');
const { getAuthenticatedUserId, createControllerLogger } = require('../utils/auth.utils');
const { issueAuthCookies } = require('../utils/session.utils');

const logUserControllerError = createControllerLogger('users');

// Maps a UserServiceError code to its HTTP status; the service message is surfaced as-is.
const STATUS_BY_ERROR_CODE = {
  validation: 400,
  not_found: 404,
  email_in_use: 400,
  no_pending: 400,
  invalid_code: 400,
  code_expired: 400,
  invalid_current_password: 401
};

// Sends a business error as its mapped status, or logs and returns a generic 500.
const handleServiceError = (req, res, operation, error, { serverErrorMessage = 'Server error.' } = {}) => {
  if (error instanceof userService.UserServiceError) {
    return res.status(STATUS_BY_ERROR_CODE[error.code] || 400).json({ error: error.message });
  }
  logUserControllerError(req, operation, error);
  return res.status(500).json({ error: serverErrorMessage });
};

// Return the total number of registered users (public stat).
const getUserCount = async (req, res) => {
  try {
    res.json({ count: await userService.getUserCount() });
  } catch (error) {
    handleServiceError(req, res, 'count', error);
  }
};

// Return the user's profile (id resolved from the verified token, not client input).
const getProfile = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  try {
    return res.json(await userService.getUserProfile(authenticatedUserId));
  } catch (error) {
    return handleServiceError(req, res, 'profile', error);
  }
};

// Update the user's profile (name immediately; email via a pending-email code flow).
const updateUser = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  try {
    const result = await userService.updateUserProfile(authenticatedUserId, req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    handleServiceError(req, res, 'update', error, { serverErrorMessage: 'Database error.' });
  }
};

// Confirm a pending email change with its one-time code.
const verifyPendingEmail = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  try {
    const user = await userService.confirmPendingEmail(authenticatedUserId, req.body || {});
    res.json({ success: true, user });
  } catch (error) {
    handleServiceError(req, res, 'verify_pending_email', error);
  }
};

// Regenerate and re-send the confirmation code for a pending email change.
const resendPendingEmail = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  try {
    await userService.resendPendingEmail(authenticatedUserId, req.body || {});
    res.json({ success: true });
  } catch (error) {
    handleServiceError(req, res, 'resend_pending_email', error);
  }
};

// Change the user's password, then re-issue a fresh session so this session keeps
// working while every other (older) session is invalidated by the password change.
const changePassword = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  try {
    const { passwordUpdatedAt } = await userService.changeUserPassword(authenticatedUserId, req.body || {});
    issueAuthCookies(res, { id: authenticatedUserId, email: req.user?.email });
    res.json({ success: true, passwordUpdatedAt });
  } catch (error) {
    handleServiceError(req, res, 'change_password', error);
  }
};

// Permanently delete the user's own account (scoped to the verified id).
const deleteAccount = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  try {
    await userService.deleteUserAccount(authenticatedUserId);
    res.json({ success: true });
  } catch (error) {
    handleServiceError(req, res, 'delete_account', error);
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
