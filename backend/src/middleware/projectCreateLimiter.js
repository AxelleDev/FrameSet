const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { getAuthenticatedUserId } = require('../utils/auth.utils');

const PROJECT_CREATE_LIMIT = 30;
const PROJECT_CREATE_WINDOW_MS = 60 * 60 * 1000;
const PROJECT_CREATE_LIMIT_MESSAGE = 'Trop de creations de projets ou de normes, reessayez dans une heure.';

const projectCreateLimiter = rateLimit({
  windowMs: PROJECT_CREATE_WINDOW_MS,
  max: PROJECT_CREATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = getAuthenticatedUserId(req);
    return userId ? `project-create:${userId}` : `project-create:anonymous:${ipKeyGenerator(req.ip)}`;
  },
  handler: (req, res) => {
    res.status(429).json({ error: PROJECT_CREATE_LIMIT_MESSAGE });
  }
});

module.exports = {
  projectCreateLimiter,
  PROJECT_CREATE_LIMIT,
  PROJECT_CREATE_WINDOW_MS,
  PROJECT_CREATE_LIMIT_MESSAGE
};