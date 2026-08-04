/**
 * Error-path battery for the auth controller: the anti-enumeration behaviors
 * (duplicate email indistinguishable from success shape, generic 500s) and
 * the clean mapping of unexpected failures on every endpoint — the raw
 * database error must never reach a client.
 */
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

jest.mock('../../src/services/mail.service');
jest.mock('../../src/database');
jest.mock('../../src/services/token.service');

const authController = require('../../src/controllers/auth.controller');
const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');

const makeRes = () => ({
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

describe('auth controller error paths', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    const body = { name: 'Axelle', email: 'axelle@example.com', password: 'Sup3rSecret!' };

    it('answers a duplicate email with a GENERIC message (no account enumeration)', async () => {
      const dup = new Error('dup');
      dup.code = 'ER_DUP_ENTRY';
      db.query.mockRejectedValueOnce(dup);
      const res = makeRes();

      await authController.register({ body, id: 'req-1' }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const payload = res.json.mock.calls.at(-1)[0];
      expect(payload.error).not.toMatch(/already|exist|taken|duplicate/i);
    });

    it('still succeeds when the verification mail fails to send (resend covers it)', async () => {
      db.query.mockResolvedValueOnce([{ insertId: 7 }]);
      mailService.sendMail.mockRejectedValueOnce(new Error('smtp down'));
      const res = makeRes();

      await authController.register({ body, id: 'req-1' }, res);
      await new Promise((resolve) => setImmediate(resolve));

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('maps an unexpected failure to a generic 500', async () => {
      db.query.mockRejectedValueOnce(new Error('connection lost'));
      const res = makeRes();

      await authController.register({ body, id: 'req-1' }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error.' });
    });
  });

  // Endpoints whose unexpected-failure contract is a clean 500 with no detail.
  const FIVE_HUNDREDS = [
    ['login', { body: { email: 'a@b.com', password: 'Password1' } }],
    ['verify', { body: { email: 'a@b.com', code: '123456' } }],
    ['resendCode', { body: { email: 'a@b.com' } }],
    ['forgotPassword', { body: { email: 'a@b.com' } }],
    ['resetPassword', { body: { email: 'a@b.com', code: '123456', newPassword: 'N3wPassword!' } }],
  ];

  describe.each(FIVE_HUNDREDS)('%s', (name, baseReq) => {
    it('maps an unexpected database failure to a clean 500', async () => {
      db.query.mockRejectedValue(new Error('connection lost'));
      const res = makeRes();

      await authController[name]({ ...baseReq, id: 'req-1' }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      const payload = res.json.mock.calls.at(-1)[0];
      expect(JSON.stringify(payload)).not.toContain('connection lost');
    });
  });

  describe('refresh', () => {
    it('rejects a request with no refresh cookie at all', async () => {
      const res = makeRes();
      await authController.refresh({ headers: {}, id: 'req-1' }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing refresh token.' });
    });
  });

  describe('demoLogin', () => {
    it('answers 503 when no demo account is seeded', async () => {
      db.query.mockResolvedValueOnce([[]]);
      const res = makeRes();

      await authController.demoLogin({ id: 'req-1' }, res);

      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('maps an unexpected failure to a clean 500', async () => {
      db.query.mockRejectedValueOnce(new Error('connection lost'));
      const res = makeRes();

      await authController.demoLogin({ id: 'req-1' }, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
