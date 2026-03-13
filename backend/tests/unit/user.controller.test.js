const userController = require('../../src/controllers/user.controller');
const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');

jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');

describe('contrôleur utilisateur', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('compter les utilisateurs', () => {
    it('devrait retourner le nombre d’utilisateurs', async () => {
      db.query.mockResolvedValue([[{ count: 5 }]]);
      const req = {};
      const res = { json: jest.fn() };
      await userController.getUserCount(req, res);
      expect(res.json).toHaveBeenCalledWith({ count: 5 });
    });
  });

  describe('profil utilisateur', () => {
    it('devrait retourner le profil de l’utilisateur authentifié', async () => {
      db.query.mockResolvedValueOnce([[{
        id: 1,
        name: 'Prénom Nom',
        email: 'axelle@example.com',
        avatar_initials: 'AT',
        password_updated_at: new Date('2026-01-01T00:00:00.000Z'),
        pending_email: null
      }]]);

      const req = { user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await userController.getProfile(req, res);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, name, email, avatar_initials, password_updated_at, pending_email FROM users WHERE id = ?',
        [1]
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        name: 'Prénom Nom',
        email: 'axelle@example.com',
        avatarInitials: 'AT'
      }));
    });
  });

  describe('mettre à jour un utilisateur', () => {
    it('devrait mettre à jour le nom de l’utilisateur', async () => {
      db.query.mockResolvedValueOnce([[{ email: 'axelle@example.com', pending_email: null }]]);
      db.query.mockResolvedValueOnce([]);
      db.query.mockResolvedValueOnce();
      const req = { user: { id: 1 }, body: { id: 999, name: 'Prénom Nom', email: 'axelle@example.com' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.updateUser(req, res);
      expect(db.query).toHaveBeenCalledWith('SELECT email, pending_email FROM users WHERE id = ?', [1]);
      expect(res.json).toHaveBeenCalledWith({ success: true, name: 'Prénom Nom', email: 'axelle@example.com', pendingEmail: null });
    });
  });

  describe('vérifier l’email en attente', () => {
    it('devrait vérifier l’email en attente', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1, name: 'Prénom Nom', pending_email: 'axelle@example.com', pending_email_code: '123456', pending_email_expires: new Date(Date.now() + 10000), avatar_initials: 'AT', password_updated_at: null }]])
        .mockResolvedValueOnce([[]]);
      const req = { user: { id: 1 }, body: { email: 'axelle@example.com', code: '123456' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.verifyPendingEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, user: expect.objectContaining({ email: 'axelle@example.com' }) });
    });
  });

  describe('renvoyer l’email en attente', () => {
    it('devrait renvoyer l’email en attente', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, name: 'Prénom Nom', pending_email: 'axelle@example.com' }]]);
      db.query.mockResolvedValueOnce();
      mailService.sendMail.mockResolvedValueOnce();
      const req = { user: { id: 1 }, body: { email: 'axelle@example.com' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.resendPendingEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('changer le mot de passe', () => {
    it('devrait changer le mot de passe', async () => {
      db.query.mockResolvedValueOnce([[{ password: 'hashed' }]]);
      require('bcryptjs').compare = jest.fn().mockResolvedValue(true);
      require('bcryptjs').hash = jest.fn().mockResolvedValue('newHashed');
      db.query.mockResolvedValueOnce();
      const req = { user: { id: 1 }, body: { id: 999, currentPassword: 'old', newPassword: 'NewPass123' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.changePassword(req, res);
      expect(db.query).toHaveBeenCalledWith('SELECT password FROM users WHERE id = ?', [1]);
      expect(res.json).toHaveBeenCalledWith({ success: true, passwordUpdatedAt: expect.any(Date) });
    });
  });
});
