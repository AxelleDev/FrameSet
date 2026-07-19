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
const googleIdentity = require('../../src/services/googleIdentity.service');
const bcrypt = require('bcryptjs');
const { hashOtp } = require('../../src/utils/otp');

jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');
jest.mock('../../src/services/googleIdentity.service');

describe('user controller', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    // Restore any jest.spyOn (e.g. on bcrypt) so a stubbed impl never leaks into the next test.
    jest.restoreAllMocks();
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
      db.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            name: 'Jane Doe',
            email: 'axelle@example.com',
            avatar_initials: 'JD',
            password_updated_at: new Date('2026-01-01T00:00:00.000Z'),
            pending_email: null,
            has_password: 1,
          },
        ],
      ]);

      const req = { user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await userController.getProfile(req, res);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, name, email, avatar_initials, password_updated_at, pending_email, (password IS NOT NULL) AS has_password FROM users WHERE id = ?',
        [1],
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Jane Doe',
          email: 'axelle@example.com',
          avatarInitials: 'JD',
          hasPassword: true,
        }),
      );
    });
  });

  describe('update a user', () => {
    it('updates the user name without requiring re-authentication', async () => {
      db.query.mockResolvedValueOnce([
        [{ email: 'axelle@example.com', pending_email: null, password: 'hashed', google_id: null }],
      ]);
      db.query.mockResolvedValueOnce([]);
      db.query.mockResolvedValueOnce();
      const req = {
        user: { id: 1 },
        body: { id: 999, name: 'Jane Doe', email: 'axelle@example.com' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.updateUser(req, res);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT email, pending_email, password, google_id FROM users WHERE id = ?',
        [1],
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        name: 'Jane Doe',
        email: 'axelle@example.com',
        pendingEmail: null,
      });
    });

    it('rejects an email change without re-authentication', async () => {
      db.query.mockResolvedValueOnce([
        [{ email: 'old@example.com', pending_email: null, password: 'hashed', google_id: null }],
      ]);
      const req = {
        user: { id: 1 },
        body: { name: 'Jane Doe', email: 'new@example.com' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.updateUser(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      // Nothing staged, nothing sent.
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('still succeeds when the pending-email code send fails', async () => {
      db.query.mockResolvedValueOnce([
        [{ email: 'old@example.com', pending_email: null, password: 'hashed', google_id: null }],
      ]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      db.query.mockResolvedValueOnce([[]]); // no other account uses the new email
      db.query.mockResolvedValueOnce(); // staging UPDATE
      mailService.sendMail.mockRejectedValueOnce(new Error('smtp down'));
      const req = {
        user: { id: 1 },
        body: { name: 'Jane Doe', email: 'new@example.com', currentPassword: 'Pass1234' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.updateUser(req, res);
      // The pending email is staged in DB; a failed send must not turn into a 500
      // (the user can use "resend").
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        name: 'Jane Doe',
        email: 'old@example.com',
        pendingEmail: 'new@example.com',
      });
    });
  });

  describe('verify the pending email', () => {
    it('verifies the pending email and alerts the previous address', async () => {
      db.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              name: 'Jane Doe',
              email: 'old@example.com',
              pending_email: 'axelle@example.com',
              pending_email_code: hashOtp('123456'),
              pending_email_expires: new Date(Date.now() + 10000),
              avatar_initials: 'JD',
              password_updated_at: null,
            },
          ],
        ])
        .mockResolvedValueOnce([[]]);
      const req = { user: { id: 1 }, body: { email: 'axelle@example.com', code: '123456' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.verifyPendingEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({ email: 'axelle@example.com' }),
      });
      // The previous owner address is alerted about the change (fire-and-forget send).
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'old@example.com',
          subject: 'Your account email was changed',
        }),
      );
    });
  });

  describe('resend the pending email', () => {
    it('resends the pending email', async () => {
      db.query.mockResolvedValueOnce([
        [{ id: 1, name: 'Jane Doe', pending_email: 'axelle@example.com' }],
      ]);
      db.query.mockResolvedValueOnce();
      mailService.sendMail.mockResolvedValueOnce();
      const req = { user: { id: 1 }, body: { email: 'axelle@example.com' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.resendPendingEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('delete the account', () => {
    it('deletes the account after password re-authentication and clears the cookies', async () => {
      db.query.mockResolvedValueOnce([[{ password: 'hashed', google_id: null }]]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { user: { id: 1 }, body: { currentPassword: 'Pass1234' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };
      await userController.deleteAccount(req, res);
      expect(db.query).toHaveBeenCalledWith('DELETE FROM users WHERE id = ?', [1]);
      // The dead session cookies must not survive the account.
      expect(res.clearCookie).toHaveBeenCalledWith('frameset_access_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('frameset_refresh_token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('rejects a deletion without re-authentication', async () => {
      db.query.mockResolvedValueOnce([[{ password: 'hashed', google_id: null }]]);
      const req = { user: { id: 1 }, body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };
      await userController.deleteAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      // The DELETE must never run without a verified identity.
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('rejects a deletion with a wrong current password', async () => {
      db.query.mockResolvedValueOnce([[{ password: 'hashed', google_id: null }]]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
      const req = { user: { id: 1 }, body: { currentPassword: 'wrong' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };
      await userController.deleteAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Current password is incorrect.' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('deletes a Google-only account after a fresh Google verification', async () => {
      db.query.mockResolvedValueOnce([[{ password: null, google_id: 'g-123' }]]);
      googleIdentity.verifyGoogleIdToken.mockResolvedValueOnce({
        status: 'ok',
        googleId: 'g-123',
      });
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { user: { id: 1 }, body: { googleCredential: 'google-id-token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };
      await userController.deleteAccount(req, res);
      expect(googleIdentity.verifyGoogleIdToken).toHaveBeenCalledWith('google-id-token');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('rejects a Google verification for a different Google identity', async () => {
      db.query.mockResolvedValueOnce([[{ password: null, google_id: 'g-123' }]]);
      googleIdentity.verifyGoogleIdToken.mockResolvedValueOnce({
        status: 'ok',
        googleId: 'g-OTHER',
      });
      const req = { user: { id: 1 }, body: { googleCredential: 'google-id-token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };
      await userController.deleteAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when the account no longer exists', async () => {
      db.query.mockResolvedValueOnce([[]]);
      const req = { user: { id: 1 }, body: { currentPassword: 'Pass1234' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.deleteAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found.' });
    });

    it('returns 401 when not authenticated', async () => {
      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await userController.deleteAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('change the password', () => {
    it('changes the password and emails a security alert', async () => {
      db.query.mockResolvedValueOnce([[{ email: 'axelle@example.com', password: 'hashed' }]]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('newHashed');
      db.query.mockResolvedValueOnce();
      const req = {
        user: { id: 1, email: 'axelle@example.com' },
        body: { id: 999, currentPassword: 'old', newPassword: 'NewPass123' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };
      await userController.changePassword(req, res);
      expect(db.query).toHaveBeenCalledWith('SELECT email, password FROM users WHERE id = ?', [1]);
      expect(res.json).toHaveBeenCalledWith({ success: true, passwordUpdatedAt: expect.any(Date) });
      // The account holder is alerted about the change (fire-and-forget send).
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'axelle@example.com',
          subject: 'Your password was changed',
        }),
      );
    });

    it('rejects a password change for a Google-only account (no password set)', async () => {
      db.query.mockResolvedValueOnce([[{ email: 'g@example.com', password: null }]]);
      const req = {
        user: { id: 1 },
        body: { currentPassword: 'whatever', newPassword: 'NewPass123' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };
      await userController.changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });
});
