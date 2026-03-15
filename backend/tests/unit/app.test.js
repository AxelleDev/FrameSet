process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';

jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: jest.fn().mockResolvedValue(true) })
}));

jest.mock('../../src/database', () => ({
  execute: jest.fn(),
  query: jest.fn(),
  getConnection: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');

describe('middleware de l\'application', () => {
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
