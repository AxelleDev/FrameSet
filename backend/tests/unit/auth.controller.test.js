jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));
const authController = require('../../src/controllers/auth.controller');
const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');
const tokenService = require('../../src/services/token.service');

jest.mock('../../src/database');
jest.mock('../../src/services/token.service');

describe('auth.controller', () => {
  const authController = require('../../src/controllers/auth.controller');
  const db = require('../../src/database');
  const mailService = require('../../src/services/mail.service');
  const tokenService = require('../../src/services/token.service');
  jest.mock('../../src/database');
  jest.mock('../../src/services/mail.service');
  jest.mock('../../src/services/token.service');

  describe('register', () => {
    it('should register user and send mail', async () => {
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);
      mailService.sendMail.mockResolvedValueOnce();
      const req = { body: { name: 'Axel', email: 'axel@a.com', password: 'pass' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await authController.register(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('login', () => {
    it('should login user and return tokens', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, name: 'Axel', email: 'axel@a.com', password: 'hashed', avatar_initials: 'A', is_verified: true }]]);
      require('bcryptjs').compare = jest.fn().mockResolvedValue(true);
      tokenService.generateRefreshToken.mockReturnValue('refreshToken');
      const req = { body: { email: 'axel@a.com', password: 'pass' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await authController.login(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });


  describe('refresh', () => {
    it('should refresh token', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      db.query.mockResolvedValueOnce([[{ id: 1, name: 'Axel', email: 'axel@a.com', avatar_initials: 'A' }]]);
      tokenService.generateRefreshToken.mockReturnValue('refreshToken');
      const req = { body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await authController.refresh(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('logout', () => {
    it('should logout user', async () => {
      const req = { body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await authController.logout(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
