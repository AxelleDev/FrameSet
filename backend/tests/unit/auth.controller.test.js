process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));
jest.mock('../../src/services/mail.service');

const authController = require('../../src/controllers/auth.controller');
const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');
const tokenService = require('../../src/services/token.service');

jest.mock('../../src/database');
jest.mock('../../src/services/token.service');

describe('contrôleur d’authentification', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('inscription', () => {
    it('devrait inscrire un utilisateur sans émettre de tokens avant vérification', async () => {
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);
      mailService.sendMail.mockResolvedValueOnce();
      const req = { body: { name: 'Axel', email: 'axel@a.com', password: 'Pass1234' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await authController.register(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      const payload = res.json.mock.calls[0][0];
      expect(payload.token).toBeUndefined();
      expect(payload.refreshToken).toBeUndefined();
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
      const refreshHandler = authController.refresh || authController.refreshToken;
      expect(typeof refreshHandler).toBe('function');

      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      tokenService.isTokenRevoked.mockResolvedValue(false);
      const req = { body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await refreshHandler(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('devrait refuser un refresh token révoqué', async () => {
      const refreshHandler = authController.refresh || authController.refreshToken;
      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      tokenService.isTokenRevoked.mockResolvedValue(true);

      const req = { id: 'req-1', body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await refreshHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token invalide ou expiré' });
    });
  });

  describe('déconnexion', () => {
    it('devrait révoquer le token d’accès et le refresh token', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      tokenService.revokeToken.mockResolvedValue(true);

      const req = {
        id: 'req-logout-1',
        user: { id: 1 },
        token: 'access-token',
        body: { refreshToken: 'refresh-token' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await authController.logout(req, res);

      expect(tokenService.revokeToken).toHaveBeenCalledWith(1, 'access-token');
      expect(tokenService.revokeToken).toHaveBeenCalledWith(1, 'refresh-token');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait retourner 401 si non authentifié', async () => {
      const req = { user: null, token: null, body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Utilisateur non authentifié.' });
    });
  });
});
