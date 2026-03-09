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

describe('contrôleur d’authentification', () => {
  const authController = require('../../src/controllers/auth.controller');
  const db = require('../../src/database');
  const mailService = require('../../src/services/mail.service');
  const tokenService = require('../../src/services/token.service');
  jest.mock('../../src/database');
  jest.mock('../../src/services/mail.service');
  jest.mock('../../src/services/token.service');

  describe('inscription', () => {
    it('devrait inscrire un utilisateur et envoyer un mail', async () => {
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);
      mailService.sendMail.mockResolvedValueOnce();
      const req = { body: { name: 'Axel', email: 'axel@a.com', password: 'pass' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await authController.register(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('connexion', () => {
    it('devrait connecter un utilisateur et retourner les jetons', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, name: 'Axel', email: 'axel@a.com', password: 'hashed', avatar_initials: 'A', is_verified: true }]]);
      require('bcryptjs').compare = jest.fn().mockResolvedValue(true);
      tokenService.generateRefreshToken.mockReturnValue('refreshToken');
      const req = { body: { email: 'axel@a.com', password: 'pass' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await authController.login(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });


  describe('rafraîchir', () => {
    it('devrait rafraîchir le jeton', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      db.query.mockResolvedValueOnce([[{ id: 1, name: 'Axel', email: 'axel@a.com', avatar_initials: 'A' }]]);
      tokenService.generateRefreshToken.mockReturnValue('refreshToken');
      const req = { body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await authController.refresh(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('déconnexion', () => {
    it('devrait déconnecter l’utilisateur', async () => {
      const req = { body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await authController.logout(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
