const express = require('express');
const rateLimit = require('express-rate-limit');
const projectsController = require('../controllers/projects.controller');
const { isE2ETestMode } = require('../utils/testMode');
const { jsonLimitHandler } = require('../utils/rateLimitHandler');

const router = express.Router();

// Raised (not disabled) in E2E test mode so repeated local Playwright runs
// from one machine don't get 429'd, while still catching a genuine runaway.
const shareViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isE2ETestMode ? 10000 : 60,
  handler: jsonLimitHandler('Too many requests, please try again in a minute.'),
});

// Specific paths first, then the bare token read.
router.get('/:token/preview.png', shareViewLimiter, projectsController.getSharedProjectPreview);
router.get('/:token/embed', shareViewLimiter, projectsController.getSharedProjectEmbed);
router.get('/:token/events', shareViewLimiter, projectsController.getSharedProjectEvents);
router.get('/:token', shareViewLimiter, projectsController.getSharedProject);

module.exports = router;
