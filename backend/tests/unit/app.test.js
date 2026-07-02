process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';
process.env.MAIL_HOST = process.env.MAIL_HOST || 'smtp.test.local';
process.env.MAIL_PORT = process.env.MAIL_PORT || '465';
process.env.MAIL_SECURE = process.env.MAIL_SECURE || 'true';
process.env.MAIL_USER = process.env.MAIL_USER || 'mail@test.local';
process.env.MAIL_PASS = process.env.MAIL_PASS || 'test_mail_password';

jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: jest.fn().mockResolvedValue(true) })
}));

jest.mock('../../src/database', () => ({
  execute: jest.fn(),
  query: jest.fn(),
  getConnection: jest.fn(),
  ping: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database');

describe('application middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('health check', () => {
    it('returns 200 with an ok status when the database is reachable', async () => {
      db.ping.mockResolvedValueOnce();

      const res = await request(app)
        .get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        status: 'ok',
        db: 'reachable',
        uptime: expect.any(Number)
      }));
    });
  });

  describe('security headers', () => {
    it('exposes an explicit Content-Security-Policy header', async () => {
      const res = await request(app)
        .get('/api/auth/csrf-token');

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['content-security-policy']).toContain("script-src 'self'");
      expect(res.headers['content-security-policy']).toContain("object-src 'none'");
    });
  });

  describe('API documentation', () => {
    it('serves the raw OpenAPI spec as JSON', async () => {
      const res = await request(app).get('/api-docs.json');

      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toBe('FrameSet API');
      expect(res.body.paths['/api/projects']).toBeDefined();
    });

    it('serves the Swagger UI page', async () => {
      const res = await request(app).get('/api-docs/');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
    });

    it('does not mount the docs when ENABLE_API_DOCS=false', async () => {
      const previous = process.env.ENABLE_API_DOCS;
      process.env.ENABLE_API_DOCS = 'false';
      jest.resetModules();
      const appWithoutDocs = require('../../src/app');

      const res = await request(appWithoutDocs).get('/api-docs.json');
      expect(res.status).toBe(404);

      process.env.ENABLE_API_DOCS = previous;
      jest.resetModules();
    });
  });

  describe('JSON size limit', () => {
    it('returns 413 for a JSON payload exceeding 10 KB', async () => {
      const largePayload = JSON.stringify({ data: 'x'.repeat(200 * 1024) });

      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(res.status).toBe(413);
    });

    it('accepts a JSON payload smaller than 10 KB', async () => {
      const smallPayload = JSON.stringify({ email: 'test@test.com', password: 'Password1' });

      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(smallPayload);

      expect(res.status).not.toBe(413);
    });
  });
});
