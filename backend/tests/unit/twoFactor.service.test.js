process.env.TOTP_ENCRYPTION_KEY =
  '20f766230f5b4740f5b620d2dde09488b110435c13395edb10e1fdcd5ddf2098';

const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');
const userService = require('../../src/services/user.service');
const twoFactorService = require('../../src/services/twoFactor.service');
const { encryptSecret } = require('../../src/utils/encryption');
const { generateTotpCode, generateTotpSecret } = require('../../src/utils/totp');
const { hashOtp } = require('../../src/utils/otp');

jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');
jest.mock('../../src/services/user.service', () => ({
  UserServiceError: class UserServiceError extends Error {
    constructor(code, message) {
      super(message || code);
      this.code = code;
    }
  },
  verifyUserIdentity: jest.fn(),
}));

// The recovery-code rotation runs on a dedicated pooled connection inside a
// transaction; this wires db.getConnection to a fully-mocked connection whose
// queries all succeed, and returns it for per-test assertions/overrides.
const mockRecoveryCodesConnection = () => {
  const connection = {
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValue([{}]),
  };
  db.getConnection.mockResolvedValue(connection);
  return connection;
};

describe('twoFactor service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('beginTotpSetup', () => {
    it('generates and stores a pending secret, returning it with an otpauth URL', async () => {
      db.query
        .mockResolvedValueOnce([[{ email: 'axelle@example.com', totp_enabled: 0 }]]) // lookup
        .mockResolvedValueOnce([{}]); // UPDATE pending secret

      const result = await twoFactorService.beginTotpSetup(1);

      expect(result.secret).toMatch(/^[A-Z2-7]+$/);
      expect(result.otpauthUrl).toContain('axelle%40example.com');
      expect(db.query.mock.calls[1][0]).toMatch(/totp_pending_secret_encrypted/);
    });

    it('throws not_found for a missing user', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await expect(twoFactorService.beginTotpSetup(999)).rejects.toMatchObject({
        code: 'not_found',
      });
    });

    it('refuses to start setup when 2FA is already enabled', async () => {
      db.query.mockResolvedValueOnce([[{ email: 'a@b.com', totp_enabled: 1 }]]);
      await expect(twoFactorService.beginTotpSetup(1)).rejects.toMatchObject({
        code: 'already_enabled',
      });
    });
  });

  describe('confirmTotpSetup', () => {
    it('activates 2FA and returns fresh recovery codes on a correct code', async () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      db.query
        .mockResolvedValueOnce([
          [{ email: 'axelle@example.com', totp_pending_secret_encrypted: encryptSecret(secret) }],
        ]) // lookup
        .mockResolvedValueOnce([{}]); // activate UPDATE
      const connection = mockRecoveryCodesConnection();

      const result = await twoFactorService.confirmTotpSetup(1, code);

      expect(connection.commit).toHaveBeenCalled();
      expect(result.recoveryCodes).toHaveLength(twoFactorService.RECOVERY_CODE_COUNT);
      // Each code is unique and shaped like XXXXX-XXXXX-XXXXX-XXXXX.
      expect(new Set(result.recoveryCodes).size).toBe(twoFactorService.RECOVERY_CODE_COUNT);
      result.recoveryCodes.forEach((recoveryCode) => {
        expect(recoveryCode).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/);
      });
      expect(db.query.mock.calls[1][0]).toMatch(/totp_enabled = true/);
      // The confirmation code's time step is consumed immediately, so the
      // same code can't be replayed at login within its 30s window.
      expect(db.query.mock.calls[1][0]).toMatch(/totp_last_used_step/);
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'axelle@example.com',
          subject: expect.stringContaining('enabled'),
        }),
      );
    });

    it('rejects a wrong code without activating anything', async () => {
      const secret = generateTotpSecret();
      db.query.mockResolvedValueOnce([
        [{ email: 'a@b.com', totp_pending_secret_encrypted: encryptSecret(secret) }],
      ]);

      await expect(twoFactorService.confirmTotpSetup(1, '000000')).rejects.toMatchObject({
        code: 'invalid_code',
      });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('throws no_pending_setup when setup was never started', async () => {
      db.query.mockResolvedValueOnce([[{ email: 'a@b.com', totp_pending_secret_encrypted: null }]]);
      await expect(twoFactorService.confirmTotpSetup(1, '123456')).rejects.toMatchObject({
        code: 'no_pending_setup',
      });
    });

    it('reports (without throwing) a mail-send failure via onMailError', async () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      db.query
        .mockResolvedValueOnce([
          [{ email: 'a@b.com', totp_pending_secret_encrypted: encryptSecret(secret) }],
        ])
        .mockResolvedValueOnce([{}]);
      mockRecoveryCodesConnection();
      mailService.sendMail.mockRejectedValueOnce(new Error('smtp down'));
      const onMailError = jest.fn();

      await twoFactorService.confirmTotpSetup(1, code, { onMailError });
      await new Promise((resolve) => setImmediate(resolve)); // let the fire-and-forget send settle

      expect(onMailError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('disableTotp', () => {
    it('clears the secret and every recovery code after a successful re-auth', async () => {
      db.query
        .mockResolvedValueOnce([[{ email: 'a@b.com', password: 'hashed', google_id: null }]])
        .mockResolvedValueOnce([{}]) // clear secret/flag
        .mockResolvedValueOnce([{}]); // delete recovery codes
      userService.verifyUserIdentity.mockResolvedValueOnce(undefined);

      await expect(
        twoFactorService.disableTotp(1, { currentPassword: 'Password1' }),
      ).resolves.toEqual({ success: true });

      expect(db.query.mock.calls[1][0]).toMatch(/totp_enabled = false/);
      expect(db.query.mock.calls[2][0]).toMatch(/DELETE FROM user_recovery_codes/);
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('disabled') }),
      );
    });

    it('propagates a failed re-authentication without touching the database further', async () => {
      db.query.mockResolvedValueOnce([[{ email: 'a@b.com', password: 'hashed', google_id: null }]]);
      userService.verifyUserIdentity.mockRejectedValueOnce(
        new userService.UserServiceError(
          'invalid_current_password',
          'Current password is incorrect.',
        ),
      );

      await expect(
        twoFactorService.disableTotp(1, { currentPassword: 'wrong' }),
      ).rejects.toMatchObject({ code: 'invalid_current_password' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('throws not_found for a missing user', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await expect(twoFactorService.disableTotp(999, {})).rejects.toMatchObject({
        code: 'not_found',
      });
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('mints a fresh set after re-auth, wiping the previous codes first', async () => {
      db.query.mockResolvedValueOnce([
        [{ email: 'axelle@example.com', password: 'hashed', google_id: null, totp_enabled: 1 }],
      ]); // lookup
      const connection = mockRecoveryCodesConnection();
      userService.verifyUserIdentity.mockResolvedValueOnce(undefined);

      const { recoveryCodes } = await twoFactorService.regenerateRecoveryCodes(1, {
        currentPassword: 'Password1',
      });

      expect(recoveryCodes).toHaveLength(twoFactorService.RECOVERY_CODE_COUNT);
      expect(new Set(recoveryCodes).size).toBe(twoFactorService.RECOVERY_CODE_COUNT);
      // Delete-then-insert, inside one transaction.
      expect(connection.beginTransaction).toHaveBeenCalled();
      expect(connection.query.mock.calls[0][0]).toMatch(/DELETE FROM user_recovery_codes/);
      expect(connection.query.mock.calls[1][0]).toMatch(/INSERT INTO user_recovery_codes/);
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'axelle@example.com',
          subject: expect.stringContaining('regenerated'),
        }),
      );
    });

    it('rolls back (keeping the old codes) when the insert fails mid-rotation', async () => {
      db.query.mockResolvedValueOnce([
        [{ email: 'axelle@example.com', password: 'hashed', google_id: null, totp_enabled: 1 }],
      ]); // lookup
      const connection = mockRecoveryCodesConnection();
      connection.query
        .mockReset()
        .mockResolvedValueOnce([{}]) // DELETE succeeds
        .mockRejectedValueOnce(new Error('db down')); // INSERT fails
      userService.verifyUserIdentity.mockResolvedValueOnce(undefined);

      await expect(
        twoFactorService.regenerateRecoveryCodes(1, { currentPassword: 'Password1' }),
      ).rejects.toThrow('db down');

      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.commit).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      // No "regenerated" alert goes out for a rotation that didn't happen.
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('refuses when 2FA is not enabled', async () => {
      db.query.mockResolvedValueOnce([
        [{ email: 'a@b.com', password: 'hashed', google_id: null, totp_enabled: 0 }],
      ]);

      await expect(
        twoFactorService.regenerateRecoveryCodes(1, { currentPassword: 'Password1' }),
      ).rejects.toMatchObject({ code: 'not_enabled' });
      expect(userService.verifyUserIdentity).not.toHaveBeenCalled();
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('propagates a failed re-authentication without touching the codes', async () => {
      db.query.mockResolvedValueOnce([
        [{ email: 'a@b.com', password: 'hashed', google_id: null, totp_enabled: 1 }],
      ]);
      userService.verifyUserIdentity.mockRejectedValueOnce(
        new userService.UserServiceError(
          'invalid_current_password',
          'Current password is incorrect.',
        ),
      );

      await expect(
        twoFactorService.regenerateRecoveryCodes(1, { currentPassword: 'wrong' }),
      ).rejects.toMatchObject({ code: 'invalid_current_password' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyTotpChallenge', () => {
    it('succeeds with a live TOTP code and records its time step against replay', async () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      db.query
        .mockResolvedValueOnce([
          [
            {
              totp_enabled: 1,
              totp_secret_encrypted: encryptSecret(secret),
              totp_last_used_step: null,
            },
          ],
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // claim the time step

      await expect(twoFactorService.verifyTotpChallenge(1, code)).resolves.toEqual({
        success: true,
        usedRecoveryCode: false,
      });
      expect(db.query.mock.calls[1][0]).toMatch(/totp_last_used_step = \?/);
    });

    it('rejects a replayed TOTP code from an already-consumed time step', async () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      // Any step the code could match (current ±1 for drift) is already spent.
      const spentStep = Math.floor(Date.now() / 1000 / 30) + 1;
      db.query.mockResolvedValueOnce([
        [
          {
            totp_enabled: 1,
            totp_secret_encrypted: encryptSecret(secret),
            totp_last_used_step: spentStep,
          },
        ],
      ]);

      await expect(twoFactorService.verifyTotpChallenge(1, code)).rejects.toMatchObject({
        code: 'invalid_code',
      });
      // No recovery-code fallback for a real-but-replayed TOTP code, and no write.
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('rejects the loser of a concurrent replay race (guarded UPDATE claims nothing)', async () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      db.query
        .mockResolvedValueOnce([
          [
            {
              totp_enabled: 1,
              totp_secret_encrypted: encryptSecret(secret),
              totp_last_used_step: null,
            },
          ],
        ])
        .mockResolvedValueOnce([{ affectedRows: 0 }]); // another login claimed the step first

      await expect(twoFactorService.verifyTotpChallenge(1, code)).rejects.toMatchObject({
        code: 'invalid_code',
      });
    });

    it('falls back to a recovery code and marks it consumed', async () => {
      const secret = generateTotpSecret();
      const recoveryCode = 'ABCDE-FGHIJ-KLMNO-PQRST';
      db.query
        .mockResolvedValueOnce([
          [{ totp_enabled: 1, totp_secret_encrypted: encryptSecret(secret) }],
        ]) // main lookup
        .mockResolvedValueOnce([[{ id: 7, code_hash: hashOtp(recoveryCode) }]]) // unused codes
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // mark used

      await expect(twoFactorService.verifyTotpChallenge(1, recoveryCode)).resolves.toEqual({
        success: true,
        usedRecoveryCode: true,
      });
      expect(db.query.mock.calls[2][0]).toMatch(/used_at = NOW\(\)/);
      expect(db.query.mock.calls[2][1]).toEqual([7]);
    });

    it('is case-insensitive when matching a recovery code', async () => {
      const secret = generateTotpSecret();
      const recoveryCode = 'ABCDE-FGHIJ-KLMNO-PQRST';
      db.query
        .mockResolvedValueOnce([
          [{ totp_enabled: 1, totp_secret_encrypted: encryptSecret(secret) }],
        ])
        .mockResolvedValueOnce([[{ id: 7, code_hash: hashOtp(recoveryCode) }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      await expect(
        twoFactorService.verifyTotpChallenge(1, recoveryCode.toLowerCase()),
      ).resolves.toEqual({ success: true, usedRecoveryCode: true });
    });

    it('rejects an already-used recovery code (it is excluded from the lookup)', async () => {
      const secret = generateTotpSecret();
      db.query
        .mockResolvedValueOnce([
          [{ totp_enabled: 1, totp_secret_encrypted: encryptSecret(secret) }],
        ])
        .mockResolvedValueOnce([[]]); // no unused codes match

      await expect(
        twoFactorService.verifyTotpChallenge(1, 'ABCDE-FGHIJ-KLMNO-PQRST'),
      ).rejects.toMatchObject({ code: 'invalid_code' });
    });

    it('rejects a wrong code entirely', async () => {
      const secret = generateTotpSecret();
      db.query
        .mockResolvedValueOnce([
          [{ totp_enabled: 1, totp_secret_encrypted: encryptSecret(secret) }],
        ])
        .mockResolvedValueOnce([[]]);

      await expect(twoFactorService.verifyTotpChallenge(1, '000000')).rejects.toMatchObject({
        code: 'invalid_code',
      });
    });

    it('throws not_enabled if 2FA was disabled between the login attempt and the challenge', async () => {
      db.query.mockResolvedValueOnce([[{ totp_enabled: 0, totp_secret_encrypted: null }]]);
      await expect(twoFactorService.verifyTotpChallenge(1, '123456')).rejects.toMatchObject({
        code: 'not_enabled',
      });
    });
  });
});
