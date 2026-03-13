const express = require('express');
const rateLimit = require('express-rate-limit');
const userController = require('../controllers/user.controller');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

const passwordChangeLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Trop de tentatives, veuillez réessayer dans une minute.'
});

const updateProfileLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 10,
	message: 'Trop de mises à jour, veuillez réessayer dans une minute.'
});

const pendingEmailVerifyLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 10,
	message: 'Trop de tentatives de vérification, réessayez dans 10 minutes.'
});

const pendingEmailResendLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 3,
	message: 'Trop de demandes de renvoi, réessayez dans 10 minutes.'
});

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
