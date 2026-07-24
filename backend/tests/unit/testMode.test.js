process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';
process.env.MAIL_HOST = process.env.MAIL_HOST || 'smtp.test.local';
process.env.MAIL_PORT = process.env.MAIL_PORT || '465';
process.env.MAIL_SECURE = process.env.MAIL_SECURE || 'true';
process.env.MAIL_USER = process.env.MAIL_USER || 'mail@test.local';
process.env.MAIL_PASS = process.env.MAIL_PASS || 'test_mail_password';

jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: jest.fn().mockResolvedValue({}) }),
}));

jest.mock('../../src/database', () => ({
  execute: jest.fn(),
  query: jest.fn(),
  getConnection: jest.fn(),
  ping: jest.fn(),
}));

const request = require('supertest');

// isE2ETestMode is read once at module load time in every file that uses it
// (routes, limiters, mail service, app.js), so each scenario below resets the
// module registry and re-requires with a fresh process.env.
describe('E2E test mode gating', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('is false with no E2E_TEST_MODE set', () => {
    delete process.env.E2E_TEST_MODE;
    jest.resetModules();
    const { isE2ETestMode } = require('../../src/utils/testMode');
    expect(isE2ETestMode).toBe(false);
  });

  it('stays false in production even if E2E_TEST_MODE=true (double-guarded)', () => {
    process.env.E2E_TEST_MODE = 'true';
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { isE2ETestMode } = require('../../src/utils/testMode');
    expect(isE2ETestMode).toBe(false);
  });

  it('is true when explicitly enabled outside production', () => {
    process.env.E2E_TEST_MODE = 'true';
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const { isE2ETestMode } = require('../../src/utils/testMode');
    expect(isE2ETestMode).toBe(true);
  });

  it('the /_test/last-email route does not exist by default', async () => {
    delete process.env.E2E_TEST_MODE;
    jest.resetModules();
    const app = require('../../src/app');

    const res = await request(app).get('/api/_test/last-email?to=someone@example.com');

    expect(res.status).toBe(404);
    // The generic 404 handler, not the test route's own 404 shape below.
    expect(res.body.error).toBe('Not found.');
  });

  it('mounts /_test/last-email and serves captured mail when explicitly enabled', async () => {
    process.env.E2E_TEST_MODE = 'true';
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const app = require('../../src/app');
    const mailService = require('../../src/services/mail.service');

    const missing = await request(app).get('/api/_test/last-email?to=nobody@example.com');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('No email captured for this recipient yet.');

    await mailService.sendMail({
      to: 'someone@example.com',
      subject: 'Your code',
      text: 'Your code is 123456',
      html: '<p>123456</p>',
    });

    const res = await request(app).get('/api/_test/last-email?to=someone@example.com');
    expect(res.status).toBe(200);
    expect(res.body.text).toContain('123456');
  });

  it('raises the project-creation rate limit only in test mode', () => {
    delete process.env.E2E_TEST_MODE;
    jest.resetModules();
    const normal = require('../../src/middleware/projectCreateLimiter');
    expect(normal.PROJECT_CREATE_LIMIT).toBe(30);

    process.env.E2E_TEST_MODE = 'true';
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const relaxed = require('../../src/middleware/projectCreateLimiter');
    expect(relaxed.PROJECT_CREATE_LIMIT).toBeGreaterThan(30);
  });
});
