/**
 * Public share route: resolves a share token to its read-only reference sheet.
 * No authentication (that is the point), so it is rate limited per IP; the
 * 128-bit tokens make brute-force enumeration impractical anyway.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const projectsController = require('../controllers/projects.controller');
const { isE2ETestMode } = require('../utils/testMode');

const router = express.Router();

// Raised (not disabled) in E2E test mode so repeated local Playwright runs
// from one machine don't get 429'd, while still catching a genuine runaway.
const shareViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isE2ETestMode ? 10000 : 60,
  message: 'Too many requests, please try again in a minute.',
});

router.get('/:token', shareViewLimiter, projectsController.getSharedProject);

module.exports = router;
