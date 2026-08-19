const isE2ETestMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';

module.exports = { isE2ETestMode };
