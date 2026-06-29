/**
 * Authentication routes.
 *
 * Mounts the auth endpoints (register, login, email verification, code resend,
 * token refresh, logout, CSRF token issuance). Each sensitive endpoint is
 * fronted by a dedicated rate limiter sized to its abuse profile, to throttle
 * credential stuffing, code brute-forcing and email-spam attempts.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// Login/register: tight per-IP limit to slow credential stuffing / spam signups.
const authLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Trop de tentatives, veuillez réessayer dans une minute.'
});

// Code verification: limits brute-force guessing of the 6-digit code.
const verifyCodeLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 10,
	message: 'Trop de tentatives de vérification, réessayez dans 10 minutes.'
});

// Code resend: strict cap to prevent using the service as an email-spam relay.
const resendCodeLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 3,
	message: 'Trop de demandes de renvoi, réessayez dans 10 minutes.'
});

// Token refresh: bounds how often clients can rotate tokens.
const refreshLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 10,
	message: 'Trop de demandes de rafraîchissement, veuillez réessayer dans une minute.'
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/csrf-token', authController.getCsrfToken);
router.post('/verify', verifyCodeLimiter, authController.verify);
router.post('/resend-code', resendCodeLimiter, authController.resendCode);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
