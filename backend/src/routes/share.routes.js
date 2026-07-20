/**
 * Public share route: resolves a share token to its read-only reference sheet.
 * No authentication (that is the point), so it is rate limited per IP; the
 * 128-bit tokens make brute-force enumeration impractical anyway.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const projectsController = require('../controllers/projects.controller');

const router = express.Router();

const shareViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many requests, please try again in a minute.',
});

router.get('/:token', shareViewLimiter, projectsController.getSharedProject);

module.exports = router;
