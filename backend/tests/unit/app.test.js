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

describe('middleware de l\'application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('health check', () => {
    it('devrait retourner 200 avec un statut ok si la base est joignable', async () => {
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

  describe('en-tetes de securite', () => {
    it('devrait exposer un header Content-Security-Policy explicite', async () => {
      const res = await request(app)
        .get('/api/auth/csrf-token');

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['content-security-policy']).toContain("script-src 'self'");
      expect(res.headers['content-security-policy']).toContain("object-src 'none'");
    });
  });

  describe('limite de taille JSON', () => {
    it('devrait retourner 413 pour un payload JSON dépassant 10 Ko', async () => {
      const largePayload = JSON.stringify({ data: 'x'.repeat(200 * 1024) });

      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(res.status).toBe(413);
    });

    it('devrait accepter un payload JSON inférieur à 10 Ko', async () => {
      const smallPayload = JSON.stringify({ email: 'test@test.com', password: 'Password1' });

      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(smallPayload);

      expect(res.status).not.toBe(413);
    });
  });
});
