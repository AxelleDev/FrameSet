const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

const router = express.Router();

const authLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Trop de tentatives, veuillez réessayer dans une minute.'
});

const verifyCodeLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 10,
	message: 'Trop de tentatives de vérification, réessayez dans 10 minutes.'
});

const resendCodeLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 3,
	message: 'Trop de demandes de renvoi, réessayez dans 10 minutes.'
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/verify', verifyCodeLimiter, authController.verify);
router.post('/resend-code', resendCodeLimiter, authController.resendCode);
router.post('/refresh', authController.refresh);

module.exports = router;
