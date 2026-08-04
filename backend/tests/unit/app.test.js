process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';
process.env.TOTP_ENCRYPTION_KEY =
  process.env.TOTP_ENCRYPTION_KEY ||
  '20f766230f5b4740f5b620d2dde09488b110435c13395edb10e1fdcd5ddf2098';
process.env.MAIL_HOST = process.env.MAIL_HOST || 'smtp.test.local';
process.env.MAIL_PORT = process.env.MAIL_PORT || '465';
process.env.MAIL_SECURE = process.env.MAIL_SECURE || 'true';
process.env.MAIL_USER = process.env.MAIL_USER || 'mail@test.local';
process.env.MAIL_PASS = process.env.MAIL_PASS || 'test_mail_password';

jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: jest.fn().mockResolvedValue(true) }),
}));

jest.mock('../../src/database', () => ({
  execute: jest.fn(),
  query: jest.fn(),
  getConnection: jest.fn(),
  ping: jest.fn(),
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

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          status: 'ok',
          db: 'reachable',
          uptime: expect.any(Number),
        }),
      );
    });
  });

  describe('versioned API alias', () => {
    it('serves the same surface under /api/v1, CSRF protection included', async () => {
      // Same endpoint, both prefixes.
      const unversioned = await request(app).get('/api/auth/csrf-token');
      const versioned = await request(app).get('/api/v1/auth/csrf-token');
      expect(unversioned.status).toBe(200);
      expect(versioned.status).toBe(200);
      expect(versioned.body).toEqual(expect.objectContaining({ csrfToken: expect.any(String) }));

      // The '/api'-mounted CSRF guard covers the alias too: an unprotected
      // mutation is rejected exactly like on the canonical prefix.
      const rejected = await request(app).post('/api/v1/auth/logout');
      expect(rejected.status).toBe(403);
      expect(rejected.body.error).toMatch(/csrf/i);
    });
  });

  describe('security headers', () => {
    it('exposes an explicit Content-Security-Policy header', async () => {
      const res = await request(app).get('/api/auth/csrf-token');

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['content-security-policy']).toContain("script-src 'self'");
      expect(res.headers['content-security-policy']).toContain("object-src 'none'");
    });
  });

  describe('CORS', () => {
    it('exposes the Retry-After header so the frontend can read it on a 429', async () => {
      const res = await request(app)
        .get('/api/auth/csrf-token')
        .set('Origin', 'http://localhost:5173');

      expect(res.headers['access-control-expose-headers']).toContain('Retry-After');
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

  describe('Content-Type enforcement', () => {
    it('rejects a non-JSON body with 415', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=test@test.com&password=Password1');

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type.');
    });

    it('allows a DELETE with no body (no Content-Type required)', async () => {
      const res = await request(app).delete('/api/projects/1');

      // Not a 415 — it proceeds into the router (then 401/403 without a session).
      expect(res.status).not.toBe(415);
    });

    it('allows a body-less POST (e.g. refresh/logout) with no Content-Type', async () => {
      const res = await request(app).post('/api/auth/refresh');

      // No body -> no payload to misinterpret, so not a 415 (proceeds into the router).
      expect(res.status).not.toBe(415);
    });
  });

  describe('JSON size limit', () => {
    it('returns 413 for a JSON payload exceeding 100 KB', async () => {
      const largePayload = JSON.stringify({ data: 'x'.repeat(200 * 1024) });

      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(res.status).toBe(413);
    });

    it('accepts a JSON payload smaller than 100 KB', async () => {
      const smallPayload = JSON.stringify({ email: 'test@test.com', password: 'Password1' });

      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(smallPayload);

      expect(res.status).not.toBe(413);
    });
  });
});
