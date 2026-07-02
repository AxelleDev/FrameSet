/**
 * Rate limiter for project and norm creation endpoints.
 *
 * Caps how many projects/norms a single user (or anonymous IP) can create per
 * hour. This curbs abuse and accidental loops that would otherwise flood the
 * database with writes, while leaving normal usage unaffected.
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { getAuthenticatedUserId } = require('../utils/auth.utils');

const PROJECT_CREATE_LIMIT = 30;
const PROJECT_CREATE_WINDOW_MS = 60 * 60 * 1000;
const PROJECT_CREATE_LIMIT_MESSAGE = 'Too many project or standard creations, try again in an hour.';

const projectCreateLimiter = rateLimit({
  windowMs: PROJECT_CREATE_WINDOW_MS,
  max: PROJECT_CREATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  // Key the limit per authenticated user when possible so the quota follows the
  // account; fall back to the client IP for unauthenticated callers.
  keyGenerator: (req) => {
    const userId = getAuthenticatedUserId(req);
    return userId ? `project-create:${userId}` : `project-create:anonymous:${ipKeyGenerator(req.ip)}`;
  },
  handler: (req, res) => {
    res.status(429).json({ error: PROJECT_CREATE_LIMIT_MESSAGE });
  }
});

// The health probe is public and unauthenticated, so cap it per IP to keep it
// from being used as a cheap way to hammer the DB (each call runs a ping).
const HEALTH_CHECK_LIMIT = 60;
const HEALTH_CHECK_WINDOW_MS = 60 * 1000;

const healthCheckLimiter = rateLimit({
  windowMs: HEALTH_CHECK_WINDOW_MS,
  max: HEALTH_CHECK_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many health checks, please slow down.' });
  }
});

module.exports = {
  projectCreateLimiter,
  healthCheckLimiter,
  PROJECT_CREATE_LIMIT,
  PROJECT_CREATE_WINDOW_MS,
  PROJECT_CREATE_LIMIT_MESSAGE
};