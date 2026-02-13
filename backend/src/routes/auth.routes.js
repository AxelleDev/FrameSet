const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify', authController.verify);
router.post('/resend-code', authController.resendCode);
router.post('/refresh', authController.refresh);

module.exports = router;
