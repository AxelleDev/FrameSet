/**
 * E2E test mode: relaxes rate limits and captures outgoing emails in memory
 * instead of sending them, so a Playwright run can read verification codes.
 * Double-guarded so an accidental env var can never activate this in
 * production, even if E2E_TEST_MODE is set by mistake.
 */
const isE2ETestMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';

module.exports = { isE2ETestMode };
