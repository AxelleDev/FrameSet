// Playwright config for FrameSet's end-to-end tests. Starts dedicated backend
// (E2E_TEST_MODE=true, so it captures outgoing emails instead of sending them —
// see backend/src/utils/testMode.js) and frontend instances on non-default
// ports, so a run never collides with — or ambiguously reuses — dev servers
// the developer might already have open on 3000/5173.
const { defineConfig } = require('@playwright/test');
const { BACKEND_PORT, FRONTEND_PORT, BACKEND_URL, FRONTEND_URL } = require('./env');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  // Real-browser UI interactions occasionally flake on animation/timing (a
  // modal's close transition, a debounce) — one retry absorbs that without
  // masking a genuine, reproducible failure (which fails again on retry too).
  retries: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm start',
      cwd: '../backend',
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PORT: String(BACKEND_PORT),
        E2E_TEST_MODE: 'true',
        FRONTEND_ORIGIN: FRONTEND_URL,
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: '../frontend',
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        VITE_API_URL: `${BACKEND_URL}/api`,
      },
    },
  ],
});
