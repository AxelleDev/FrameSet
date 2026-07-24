/**
 * Auth routes. Each sensitive endpoint is fronted by a dedicated rate limiter
 * sized to its abuse profile (credential stuffing, code brute-forcing, email spam).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { isE2ETestMode } = require('../utils/testMode');

const router = express.Router();

// Raised (not disabled) in E2E test mode so repeated local Playwright runs
// from one machine don't get 429'd, while still catching a genuine runaway.
const maxFor = (normalMax) => (isE2ETestMode ? 10000 : normalMax);

// Login: tight per-IP limit to slow credential stuffing. Separate from register
// so a burst of one can't consume the other's quota.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: maxFor(5),
  message: 'Too many attempts, please try again in a minute.',
});

// Register: per-IP limit to slow spam signups, independent from login.
const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: maxFor(5),
  message: 'Too many attempts, please try again in a minute.',
});

// Email verification: limits brute-force guessing of the 6-digit code. A dedicated
// instance per route (not shared with reset-password) so one route's traffic can't
// consume the other's quota and lock out a legitimate user.
const verifyCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(10),
  message: 'Too many verification attempts, try again in 10 minutes.',
});

// Password reset: limits brute-force guessing of the reset code. Separate instance
// from email verification so the two flows keep independent quotas.
const resetPasswordLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(10),
  message: 'Too many attempts, try again in 10 minutes.',
});

// Verification-code resend: strict cap to prevent using the service as an email-spam
// relay. Dedicated instance, independent from the forgot-password quota below.
const resendCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(3),
  message: 'Too many resend requests, try again in 10 minutes.',
});

// Forgot-password: strict cap on reset-code emails. Separate instance from the
// resend limiter so neither flow can exhaust the other's quota.
const forgotPasswordLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: maxFor(3),
  message: 'Too many requests, try again in 10 minutes.',
});

// Token refresh: bounds how often clients can rotate tokens.
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: maxFor(10),
  message: 'Too many refresh requests, please try again in a minute.',
});

// Google sign-in: each call verifies a Google ID token and may create/link an
// account, so it gets its own login-grade per-IP cap.
const googleSignInLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: maxFor(10),
  message: 'Too many attempts, please try again in a minute.',
});

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/demo-login', loginLimiter, authController.demoLogin);
router.post('/google', googleSignInLimiter, authController.googleSignIn);
router.get('/csrf-token', authController.getCsrfToken);
router.post('/verify', verifyCodeLimiter, authController.verify);
router.post('/resend-code', resendCodeLimiter, authController.resendCode);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
