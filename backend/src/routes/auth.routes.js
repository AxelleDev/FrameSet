/**
 * Auth routes. Each sensitive endpoint is fronted by a dedicated rate limiter
 * sized to its abuse profile (credential stuffing, code brute-forcing, email spam).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// Login: tight per-IP limit to slow credential stuffing. Separate from register
// so a burst of one can't consume the other's quota.
const loginLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Too many attempts, please try again in a minute.'
});

// Register: per-IP limit to slow spam signups, independent from login.
const registerLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Too many attempts, please try again in a minute.'
});

// Code verification: limits brute-force guessing of the 6-digit code.
const verifyCodeLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 10,
	message: 'Too many verification attempts, try again in 10 minutes.'
});

// Code resend: strict cap to prevent using the service as an email-spam relay.
const resendCodeLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 3,
	message: 'Too many resend requests, try again in 10 minutes.'
});

// Token refresh: bounds how often clients can rotate tokens.
const refreshLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 10,
	message: 'Too many refresh requests, please try again in a minute.'
});

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/csrf-token', authController.getCsrfToken);
router.post('/verify', verifyCodeLimiter, authController.verify);
router.post('/resend-code', resendCodeLimiter, authController.resendCode);
router.post('/forgot-password', resendCodeLimiter, authController.forgotPassword);
router.post('/reset-password', verifyCodeLimiter, authController.resetPassword);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
