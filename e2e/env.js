// Shared port/URL constants for both playwright.config.js (which starts the
// servers) and the specs (which need to know where they are).
const BACKEND_PORT = 3100;
const FRONTEND_PORT = 5273;

module.exports = {
  BACKEND_PORT,
  FRONTEND_PORT,
  BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
  FRONTEND_URL: `http://localhost:${FRONTEND_PORT}`,
};
