const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

const router = express.Router();

const authLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Trop de tentatives, veuillez réessayer dans une minute.'
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify', authController.verify);
router.post('/resend-code', authController.resendCode);
router.post('/refresh', authController.refresh);

module.exports = router;
