/**
 * Shared express-rate-limit handler: always responds with JSON ({ error }),
 * matching every other error response in the API. Passing a bare `message`
 * string to express-rate-limit sends it as plain text instead, which the
 * frontend's JSON-only parser then silently drops in favor of a generic
 * "Too Many Requests" (see services/api.js) — this keeps the carefully worded
 * per-limiter messages actually reaching the user.
 */
const jsonLimitHandler = (message) => (req, res) => {
  res.status(429).json({ error: message });
};

module.exports = { jsonLimitHandler };
