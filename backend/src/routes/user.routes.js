/**
 * User account routes: user count, profile read/update, password change, pending
 * email confirmation, account deletion. Mutating endpoints are individually rate
 * limited (password guessing, email spam, repeated deletion attempts).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const userController = require('../controllers/user.controller');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// Password change: limits attempts that also revalidate the current password.
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many attempts, please try again in a minute.',
});

// Profile update: bounds rapid repeated profile edits / email-change triggers.
const updateProfileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many updates, please try again in a minute.',
});

// Pending-email verification: limits brute-forcing of the confirmation code.
const pendingEmailVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many verification attempts, try again in 10 minutes.',
});

// Pending-email resend: strict cap to avoid email-spam abuse.
const pendingEmailResendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: 'Too many resend requests, try again in 10 minutes.',
});

// Account deletion: strict cap on a destructive, irreversible operation.
const deleteAccountLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: 'Too many attempts, try again in 10 minutes.',
});

// User count: intentionally public (shown on the landing page) but rate limited,
// since every call runs a COUNT(*) and it is otherwise a free DB-load vector.
const userCountLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many requests, please try again in a minute.',
});

router.get('/count', userCountLimiter, userController.getUserCount);
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/', authenticateToken, updateProfileLimiter, userController.updateUser);
router.post('/password', authenticateToken, passwordChangeLimiter, userController.changePassword);
router.post(
  '/email/verify',
  authenticateToken,
  pendingEmailVerifyLimiter,
  userController.verifyPendingEmail,
);
router.post(
  '/email/resend',
  authenticateToken,
  pendingEmailResendLimiter,
  userController.resendPendingEmail,
);
router.delete('/me', authenticateToken, deleteAccountLimiter, userController.deleteAccount);

module.exports = router;
