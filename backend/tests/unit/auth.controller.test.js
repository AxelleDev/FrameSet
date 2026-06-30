process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';
process.env.MAIL_HOST = process.env.MAIL_HOST || 'smtp.test.local';
process.env.MAIL_PORT = process.env.MAIL_PORT || '465';
process.env.MAIL_SECURE = process.env.MAIL_SECURE || 'true';
process.env.MAIL_USER = process.env.MAIL_USER || 'mail@test.local';
process.env.MAIL_PASS = process.env.MAIL_PASS || 'test_mail_password';

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));
jest.mock('../../src/services/mail.service');

const jwt = require('jsonwebtoken');
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
      const req = { body: { name: '  Prénom   Nom  ', email: '  axelle@example.com  ', password: '  Pass1234  ' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await authController.register(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      const payload = res.json.mock.calls[0][0];
      expect(payload.name).toBe('Prénom   Nom');
      expect(payload.avatarInitials).toBe('PN');
      expect(payload.token).toBeUndefined();
      expect(payload.refreshToken).toBeUndefined();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining(['Prénom   Nom', 'axelle@example.com'])
      );
    });

    it('devrait refuser un nom rempli uniquement d\'espaces', async () => {
      const req = { body: { name: '   ', email: 'axelle@example.com', password: 'Pass1234' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Tous les champs sont obligatoires.' });
      expect(db.query).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('connexion', () => {
    it('devrait connecter un utilisateur et définir les cookies HttpOnly', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, name: 'Prénom Nom', email: 'axelle@example.com', password: 'hashed', avatar_initials: 'PN', is_verified: true }]]);
      require('bcryptjs').compare = jest.fn().mockResolvedValue(true);
      tokenService.generateRefreshToken.mockReturnValue('refreshToken');
      const req = { body: { email: 'axelle@example.com', password: 'pass' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };
      await authController.login(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(res.cookie).toHaveBeenCalledTimes(2);
      const payload = res.json.mock.calls[0][0];
      expect(payload.token).toBeUndefined();
      expect(payload.refreshToken).toBeUndefined();
    });
  });


  describe('rafraîchir', () => {
    it('devrait rafraîchir le jeton', async () => {
      const refreshHandler = authController.refresh || authController.refreshToken;
      expect(typeof refreshHandler).toBe('function');

      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      tokenService.isTokenRevoked.mockResolvedValue(false);
      tokenService.generateRefreshToken.mockReturnValue('rotated-refresh-token');
      tokenService.revokeToken.mockResolvedValue(true);
      const req = { body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };
      await refreshHandler(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(tokenService.revokeToken).toHaveBeenCalledWith(1, 'token');
      expect(res.cookie).toHaveBeenCalledTimes(2);
    });

    it('devrait refuser un refresh token révoqué', async () => {
      const refreshHandler = authController.refresh || authController.refreshToken;
      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      tokenService.isTokenRevoked.mockResolvedValue(true);

      const req = { id: 'req-1', body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };

      await refreshHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token invalide ou expiré' });
    });

    it('devrait retourner 500 si la rotation du refresh token échoue', async () => {
      const refreshHandler = authController.refresh || authController.refreshToken;
      tokenService.verifyRefreshToken.mockReturnValue({ id: 1, email: 'axelle@example.com' });
      tokenService.isTokenRevoked.mockResolvedValue(false);
      tokenService.generateRefreshToken.mockReturnValue('rotated-refresh-token');
      tokenService.revokeToken.mockResolvedValue(false);

      const req = { id: 'req-refresh-1', body: { refreshToken: 'token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };

      await refreshHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Erreur serveur' });
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('déconnexion', () => {
    it('devrait révoquer le token d’accès et le refresh token', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      tokenService.revokeToken.mockResolvedValue(true);
      const accessToken = jwt.sign({ id: 1, email: 'axelle@example.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const req = {
        id: 'req-logout-1',
        token: accessToken,
        body: { refreshToken: 'refresh-token' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };

      await authController.logout(req, res);

      expect(tokenService.revokeToken).toHaveBeenCalledWith(1, accessToken);
      expect(tokenService.revokeToken).toHaveBeenCalledWith(1, 'refresh-token');
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });

    it('devrait permettre la déconnexion avec access token expiré si le refresh token est valide', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({ id: 1 });
      tokenService.revokeToken.mockResolvedValue(true);
      const expiredAccessToken = jwt.sign({ id: 1, email: 'axelle@example.com' }, process.env.JWT_SECRET, { expiresIn: -10 });

      const req = {
        id: 'req-logout-2',
        headers: { authorization: `Bearer ${expiredAccessToken}` },
        body: { refreshToken: 'refresh-token' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };

      await authController.logout(req, res);

      expect(tokenService.revokeToken).toHaveBeenCalledWith(1, expiredAccessToken);
      expect(tokenService.revokeToken).toHaveBeenCalledWith(1, 'refresh-token');
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });

    it('devrait retourner success même sans session active', async () => {
      const req = { headers: {}, body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };

      await authController.logout(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });
  });
});
