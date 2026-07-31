/**
 * User account routes: user count, profile read/update, password change, pending
 * email confirmation, account deletion. Mutating endpoints are individually rate
 * limited (password guessing, email spam, repeated deletion attempts).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const userController = require('../controllers/user.controller');
const authenticateToken = require('../middleware/authenticateToken');
const { isE2ETestMode } = require('../utils/testMode');
const { jsonLimitHandler } = require('../utils/rateLimitHandler');

const router = express.Router();

// Raised (not disabled) in E2E test mode so repeated local Playwright runs
// from one machine don't get 429'd, while still catching a genuine runaway.
const maxFor = (normalMax) => (isE2ETestMode ? 10000 : normalMax);

// Password change: limits attempts that also revalidate the current password.
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: maxFor(5),
  handler: jsonLimitHandler('Too many attempts, please try again in a minute.'),
});

// Profile update: bounds rapid repeated profile edits / email-change triggers.
const updateProfileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: maxFor(10),
  handler: jsonLimitHandler('Too many updates, please try again in a minute.'),
});

// Pending-email verification: limits brute-forcing of the confirmation code.
const pendingEmailVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(10),
  handler: jsonLimitHandler('Too many verification attempts, try again in 10 minutes.'),
});

// Pending-email resend: strict cap to avoid email-spam abuse.
const pendingEmailResendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(3),
  handler: jsonLimitHandler('Too many resend requests, try again in 10 minutes.'),
});

// Account deletion: strict cap on a destructive, irreversible operation.
const deleteAccountLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(3),
  handler: jsonLimitHandler('Too many attempts, try again in 10 minutes.'),
});

// TOTP setup: bounds how often a new secret can be generated.
const totpSetupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(5),
  handler: jsonLimitHandler('Too many attempts, try again in 10 minutes.'),
});

// TOTP confirm: limits brute-forcing the 6-digit code during enrollment.
const totpConfirmLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(10),
  handler: jsonLimitHandler('Too many verification attempts, try again in 10 minutes.'),
});

// TOTP disable: a security-sensitive action, capped like account deletion.
const totpDisableLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(3),
  handler: jsonLimitHandler('Too many attempts, try again in 10 minutes.'),
});

// Recovery-code regeneration: same sensitivity (it rotates sign-in
// credentials), same cap as the disable above.
const totpRecoveryCodesLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(3),
  handler: jsonLimitHandler('Too many attempts, try again in 10 minutes.'),
});

// User count: intentionally public (shown on the landing page) but rate limited,
// since every call runs a COUNT(*) and it is otherwise a free DB-load vector.
const userCountLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: maxFor(30),
  handler: jsonLimitHandler('Too many requests, please try again in a minute.'),
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

router.post('/totp/setup', authenticateToken, totpSetupLimiter, userController.setupTotp);
router.post('/totp/confirm', authenticateToken, totpConfirmLimiter, userController.confirmTotp);
router.post('/totp/disable', authenticateToken, totpDisableLimiter, userController.disableTotp);
router.post(
  '/totp/recovery-codes',
  authenticateToken,
  totpRecoveryCodesLimiter,
  userController.regenerateRecoveryCodes,
);

module.exports = router;
