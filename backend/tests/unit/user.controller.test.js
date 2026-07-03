process.env.MAIL_HOST = process.env.MAIL_HOST || 'smtp.test.local';
process.env.MAIL_PORT = process.env.MAIL_PORT || '465';
process.env.MAIL_SECURE = process.env.MAIL_SECURE || 'true';
process.env.MAIL_USER = process.env.MAIL_USER || 'mail@test.local';
process.env.MAIL_PASS = process.env.MAIL_PASS || 'test_mail_password';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';

const userController = require('../../src/controllers/user.controller');
const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');
const { hashOtp } = require('../../src/utils/otp');

jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');

describe('user controller', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('count users', () => {
    it('returns the number of users', async () => {
      db.query.mockResolvedValue([[{ count: 5 }]]);
      const req = {};
      const res = { json: jest.fn() };
      await userController.getUserCount(req, res);
      expect(res.json).toHaveBeenCalledWith({ count: 5 });
    });
  });

  describe('user profile', () => {
    it('returns the profile of the authenticated user', async () => {
      db.query.mockResolvedValueOnce([[{
        id: 1,
        name: 'Jane Doe',
        email: 'axelle@example.com',
        avatar_initials: 'JD',
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
        name: 'Jane Doe',
        email: 'axelle@example.com',
        avatarInitials: 'JD'
      }));
    });
  });

  describe('update a user', () => {
    it('updates the user name', async () => {
      db.query.mockResolvedValueOnce([[{ email: 'axelle@example.com', pending_email: null }]]);
      db.query.mockResolvedValueOnce([]);
      db.query.mockResolvedValueOnce();
      const req = { user: { id: 1 }, body: { id: 999, name: 'Jane Doe', email: 'axelle@example.com' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.updateUser(req, res);
      expect(db.query).toHaveBeenCalledWith('SELECT email, pending_email FROM users WHERE id = ?', [1]);
      expect(res.json).toHaveBeenCalledWith({ success: true, name: 'Jane Doe', email: 'axelle@example.com', pendingEmail: null });
    });
  });

  describe('verify the pending email', () => {
    it('verifies the pending email', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1, name: 'Jane Doe', pending_email: 'axelle@example.com', pending_email_code: hashOtp('123456'), pending_email_expires: new Date(Date.now() + 10000), avatar_initials: 'JD', password_updated_at: null }]])
        .mockResolvedValueOnce([[]]);
      const req = { user: { id: 1 }, body: { email: 'axelle@example.com', code: '123456' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.verifyPendingEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, user: expect.objectContaining({ email: 'axelle@example.com' }) });
    });
  });

  describe('resend the pending email', () => {
    it('resends the pending email', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, name: 'Jane Doe', pending_email: 'axelle@example.com' }]]);
      db.query.mockResolvedValueOnce();
      mailService.sendMail.mockResolvedValueOnce();
      const req = { user: { id: 1 }, body: { email: 'axelle@example.com' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.resendPendingEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('change the password', () => {
    it('changes the password', async () => {
      db.query.mockResolvedValueOnce([[{ password: 'hashed' }]]);
      require('bcryptjs').compare = jest.fn().mockResolvedValue(true);
      require('bcryptjs').hash = jest.fn().mockResolvedValue('newHashed');
      db.query.mockResolvedValueOnce();
      const req = { user: { id: 1, email: 'axelle@example.com' }, body: { id: 999, currentPassword: 'old', newPassword: 'NewPass123' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };
      await userController.changePassword(req, res);
      expect(db.query).toHaveBeenCalledWith('SELECT password FROM users WHERE id = ?', [1]);
      expect(res.json).toHaveBeenCalledWith({ success: true, passwordUpdatedAt: expect.any(Date) });
    });
  });
});
