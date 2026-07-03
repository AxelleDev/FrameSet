process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';

const authService = require('../../src/services/auth.service');
const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');
const { hashOtp } = require('../../src/utils/otp');

jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');

describe('auth service — OTP security hardening', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('resendVerificationCode (anti-enumeration)', () => {
    it('returns a generic success and sends nothing for an unknown email', async () => {
      db.query.mockResolvedValueOnce([[]]); // SELECT -> no user
      await expect(
        authService.resendVerificationCode({ email: 'nobody@example.com' }),
      ).resolves.toEqual({ success: true });
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('returns a generic success and sends nothing for an already-verified account', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1, email: 'a@b.com', is_verified: 1 }]]);
      await expect(authService.resendVerificationCode({ email: 'a@b.com' })).resolves.toEqual({
        success: true,
      });
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailCode (anti-enumeration + hashing + attempt limit)', () => {
    it('returns the generic "Incorrect code." for an unknown email (no enumeration)', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await expect(
        authService.verifyEmailCode({ email: 'x@y.com', code: '123456' }),
      ).rejects.toMatchObject({ message: 'Incorrect code.' });
    });

    it('matches the correct plaintext code against its stored hash', async () => {
      db.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            email: 'a@b.com',
            is_verified: 0,
            verification_code: hashOtp('654321'),
            verification_code_expires: new Date(Date.now() + 10000),
            otp_attempts: 0,
          },
        ],
      ]);
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // the verify UPDATE
      await expect(
        authService.verifyEmailCode({ email: 'a@b.com', code: '654321' }),
      ).resolves.toEqual({ success: true });
    });

    it('invalidates the code after too many wrong attempts', async () => {
      db.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            email: 'a@b.com',
            is_verified: 0,
            verification_code: hashOtp('654321'),
            otp_attempts: 4,
          },
        ],
      ]);
      db.query.mockResolvedValueOnce([{}]); // the invalidation UPDATE
      await expect(
        authService.verifyEmailCode({ email: 'a@b.com', code: '000000' }),
      ).rejects.toMatchObject({ message: 'Incorrect code.' });
      // The 5th wrong attempt clears the stored code.
      expect(db.query.mock.calls[1][0]).toMatch(/verification_code = NULL/);
    });
  });
});
