/**
 * User account routes.
 *
 * Endpoints for reading the user count, fetching/updating the authenticated
 * user's profile, changing the password, confirming a pending email change and
 * deleting the account. Mutating endpoints are individually rate limited to
 * resist abuse (password guessing, email spam, repeated deletion attempts).
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
	message: 'Trop de tentatives, veuillez réessayer dans une minute.'
});

// Profile update: bounds rapid repeated profile edits / email-change triggers.
const updateProfileLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 10,
	message: 'Trop de mises à jour, veuillez réessayer dans une minute.'
});

// Pending-email verification: limits brute-forcing of the confirmation code.
const pendingEmailVerifyLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 10,
	message: 'Trop de tentatives de vérification, réessayez dans 10 minutes.'
});

// Pending-email resend: strict cap to avoid email-spam abuse.
const pendingEmailResendLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 3,
	message: 'Trop de demandes de renvoi, réessayez dans 10 minutes.'
});

// Account deletion: strict cap on a destructive, irreversible operation.
const deleteAccountLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 3,
	message: 'Trop de tentatives, réessayez dans 10 minutes.'
});

router.get('/count', userController.getUserCount);
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/', authenticateToken, updateProfileLimiter, userController.updateUser);
router.post('/password', authenticateToken, passwordChangeLimiter, userController.changePassword);
router.post('/email/verify', authenticateToken, pendingEmailVerifyLimiter, userController.verifyPendingEmail);
router.post('/email/resend', authenticateToken, pendingEmailResendLimiter, userController.resendPendingEmail);
router.delete('/me', authenticateToken, deleteAccountLimiter, userController.deleteAccount);

module.exports = router;
