/**
 * Rate limiters: caps project/norm creation per user (or anon IP) per hour to
 * curb write floods, plus a per-IP cap on the public /health probe.
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { getAuthenticatedUserId } = require('../utils/auth.utils');
const { isE2ETestMode } = require('../utils/testMode');

// Raised (not disabled) in E2E test mode so repeated local Playwright runs
// from one machine don't get 429'd, while still catching a genuine runaway.
const PROJECT_CREATE_LIMIT = isE2ETestMode ? 10000 : 30;
const PROJECT_CREATE_WINDOW_MS = 60 * 60 * 1000;
const PROJECT_CREATE_LIMIT_MESSAGE =
  'Too many project or standard creations, try again in an hour.';

const projectCreateLimiter = rateLimit({
  windowMs: PROJECT_CREATE_WINDOW_MS,
  max: PROJECT_CREATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  // Key the limit per authenticated user when possible so the quota follows the
  // account; fall back to the client IP for unauthenticated callers.
  keyGenerator: (req) => {
    const userId = getAuthenticatedUserId(req);
    return userId
      ? `project-create:${userId}`
      : `project-create:anonymous:${ipKeyGenerator(req.ip)}`;
  },
  handler: (req, res) => {
    res.status(429).json({ error: PROJECT_CREATE_LIMIT_MESSAGE });
  },
});

// Palette saves are routine editing actions, not creations: the palette
// endpoint replaces the whole palette, so every add, edit, reorder or import
// is one POST. A dedicated, much more generous per-user cap still stops a
// runaway script but can never lock out an active editing session — and it is
// deliberately NOT shared with projectCreateLimiter, so palette edits can't
// consume the creation quota (nor the other way around).
const PALETTE_WRITE_LIMIT = isE2ETestMode ? 10000 : 300;
const PALETTE_WRITE_WINDOW_MS = 60 * 60 * 1000;
const PALETTE_WRITE_LIMIT_MESSAGE = 'Too many palette updates, try again later.';

const paletteWriteLimiter = rateLimit({
  windowMs: PALETTE_WRITE_WINDOW_MS,
  max: PALETTE_WRITE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = getAuthenticatedUserId(req);
    return userId ? `palette-write:${userId}` : `palette-write:anonymous:${ipKeyGenerator(req.ip)}`;
  },
  handler: (req, res) => {
    res.status(429).json({ error: PALETTE_WRITE_LIMIT_MESSAGE });
  },
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
  },
});

module.exports = {
  projectCreateLimiter,
  paletteWriteLimiter,
  healthCheckLimiter,
  PROJECT_CREATE_LIMIT,
  PROJECT_CREATE_WINDOW_MS,
  PROJECT_CREATE_LIMIT_MESSAGE,
  PALETTE_WRITE_LIMIT,
  PALETTE_WRITE_WINDOW_MS,
  PALETTE_WRITE_LIMIT_MESSAGE,
};
