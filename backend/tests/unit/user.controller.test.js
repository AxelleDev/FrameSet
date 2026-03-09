const userController = require('../../src/controllers/user.controller');
const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');

jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');

describe('user.controller', () => {
  describe('getUserCount', () => {
    it('should return user count', async () => {
      db.query.mockResolvedValue([[{ count: 5 }]]);
      const req = {};
      const res = { json: jest.fn() };
      await userController.getUserCount(req, res);
      expect(res.json).toHaveBeenCalledWith({ count: 5 });
    });
  });

  describe('updateUser', () => {
    it('should update user name', async () => {
      db.query.mockResolvedValueOnce([[{ email: 'a@b.com', pending_email: null }]]);
      db.query.mockResolvedValueOnce([]);
      db.query.mockResolvedValueOnce();
      const req = { body: { id: 1, name: 'Axel', email: 'a@b.com' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.updateUser(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, name: 'Axel', email: 'a@b.com', pendingEmail: null });
    });
  });

  describe('verifyPendingEmail', () => {
    it('should verify pending email', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1, name: 'Axel', pending_email: 'a@b.com', pending_email_code: '123456', pending_email_expires: new Date(Date.now() + 10000), avatar_initials: 'A', password_updated_at: null }]])
        .mockResolvedValueOnce([[]]);
      const req = { body: { email: 'a@b.com', code: '123456' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.verifyPendingEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, user: expect.objectContaining({ email: 'a@b.com' }) });
    });
  });

  describe('resendPendingEmail', () => {
    it('should resend pending email', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, name: 'Axel', pending_email: 'a@b.com' }]]);
      db.query.mockResolvedValueOnce();
      mailService.sendMail.mockResolvedValueOnce();
      const req = { body: { email: 'a@b.com' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.resendPendingEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      db.query.mockResolvedValueOnce([[{ password: 'hashed' }]]);
      require('bcryptjs').compare = jest.fn().mockResolvedValue(true);
      require('bcryptjs').hash = jest.fn().mockResolvedValue('newHashed');
      db.query.mockResolvedValueOnce();
      const req = { body: { id: 1, currentPassword: 'old', newPassword: 'new' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.changePassword(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, passwordUpdatedAt: expect.any(Date) });
    });
  });
});
