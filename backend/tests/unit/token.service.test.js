process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';
process.env.TOTP_ENCRYPTION_KEY =
  '20f766230f5b4740f5b620d2dde09488b110435c13395edb10e1fdcd5ddf2098';

const { createHash } = require('crypto');

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'token'),
  verify: jest.fn(() => ({ id: 1 })),
}));
jest.mock('../../src/database', () => ({
  query: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const db = require('../../src/database');
const tokenService = require('../../src/services/token.service');

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

describe('token service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a refresh token', () => {
    jwt.sign.mockReturnValue('token');
    const token = tokenService.generateRefreshToken({ id: 1 });
    expect(token).toBe('token');
  });

  it('verifies the refresh token', () => {
    jwt.verify.mockReturnValue({ id: 1 });
    const payload = tokenService.verifyRefreshToken('token');
    expect(payload).toEqual({ id: 1 });
  });

  it('returns null for an invalid token', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('fail');
    });
    const payload = tokenService.verifyRefreshToken('badtoken');
    expect(payload).toBeNull();
  });

  it('revokes a token', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const ok = await tokenService.revokeToken(1, 'abc');
    expect(ok).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      'INSERT IGNORE INTO revoked_tokens (user_id, token) VALUES (?, ?)',
      [1, hashToken('abc')],
    );
  });

  it('reports a lost claim when the token was already revoked', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const ok = await tokenService.revokeToken(1, 'abc');
    expect(ok).toBe(false);
  });

  it('detects a revoked token', async () => {
    db.query.mockResolvedValueOnce([[{ id: 99 }]]);
    const revoked = await tokenService.isTokenRevoked(1, 'abc');
    expect(revoked).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      'SELECT id FROM revoked_tokens WHERE user_id = ? AND token = ? LIMIT 1',
      [1, hashToken('abc')],
    );
  });

  it('returns false for a token that is not revoked', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const revoked = await tokenService.isTokenRevoked(1, 'abc');
    expect(revoked).toBe(false);
  });

  it('refuses to revoke an empty token', async () => {
    const ok = await tokenService.revokeToken(1, '');
    expect(ok).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('treats an empty token as revoked (fail-closed)', async () => {
    const revoked = await tokenService.isTokenRevoked(1, '');
    expect(revoked).toBe(true);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('throws an error when the revocation check fails in the database', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));

    await expect(tokenService.isTokenRevoked(1, 'abc')).rejects.toMatchObject({
      message: 'TOKEN_REVOCATION_CHECK_FAILED',
    });
  });

  it('returns false when revoking fails in the database (best effort)', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));
    const ok = await tokenService.revokeToken(1, 'abc');
    expect(ok).toBe(false);
  });

  describe('isPasswordChangedAfterIssuance', () => {
    it('never marks a token stale without an issue time or a change date', () => {
      expect(tokenService.isPasswordChangedAfterIssuance(new Date(), undefined)).toBe(false);
      expect(tokenService.isPasswordChangedAfterIssuance(null, 1000)).toBe(false);
    });

    it('marks a token stale when the password changed after issuance', () => {
      const iatSeconds = 1_000_000;
      const changedAt = new Date((iatSeconds + 60) * 1000);
      expect(tokenService.isPasswordChangedAfterIssuance(changedAt, iatSeconds)).toBe(true);
    });

    it('absorbs clock skew: a change within the 5s leeway is not stale', () => {
      const iatSeconds = 1_000_000;
      const changedAt = new Date((iatSeconds + 5) * 1000);
      expect(tokenService.isPasswordChangedAfterIssuance(changedAt, iatSeconds)).toBe(false);
    });
  });

  describe('isTokenStaleByPasswordChange', () => {
    it('treats a missing user id as stale (fail-closed)', async () => {
      const stale = await tokenService.isTokenStaleByPasswordChange(null, 1000);
      expect(stale).toBe(true);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('cannot prove staleness without an issue time', async () => {
      const stale = await tokenService.isTokenStaleByPasswordChange(1, undefined);
      expect(stale).toBe(false);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('treats a deleted user as stale', async () => {
      db.query.mockResolvedValueOnce([[]]);
      const stale = await tokenService.isTokenStaleByPasswordChange(1, 1000);
      expect(stale).toBe(true);
    });

    it('marks the token stale when the password changed after issuance', async () => {
      const iatSeconds = 1_000_000;
      db.query.mockResolvedValueOnce([
        [{ password_updated_at: new Date((iatSeconds + 60) * 1000) }],
      ]);
      const stale = await tokenService.isTokenStaleByPasswordChange(1, iatSeconds);
      expect(stale).toBe(true);
    });

    it('keeps the token valid when the password has not changed since', async () => {
      const iatSeconds = 1_000_000;
      db.query.mockResolvedValueOnce([
        [{ password_updated_at: new Date((iatSeconds - 60) * 1000) }],
      ]);
      const stale = await tokenService.isTokenStaleByPasswordChange(1, iatSeconds);
      expect(stale).toBe(false);
    });

    it('throws (fail-closed) when the staleness check fails in the database', async () => {
      db.query.mockRejectedValueOnce(new Error('db down'));

      await expect(tokenService.isTokenStaleByPasswordChange(1, 1000)).rejects.toMatchObject({
        message: 'CREDENTIALS_CHECK_FAILED',
      });
    });
  });

  describe('getUserAuthState', () => {
    it('reports not-found for a missing user id without querying', async () => {
      const state = await tokenService.getUserAuthState(null);
      expect(state).toEqual({ found: false, passwordUpdatedAt: null, isDemo: false });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('reports not-found for a deleted user', async () => {
      db.query.mockResolvedValueOnce([[]]);
      const state = await tokenService.getUserAuthState(1);
      expect(state).toEqual({ found: false, passwordUpdatedAt: null, isDemo: false });
    });

    it('returns the user state, coercing is_demo to a boolean', async () => {
      const changedAt = new Date('2026-01-01T00:00:00Z');
      db.query.mockResolvedValueOnce([[{ password_updated_at: changedAt, is_demo: 1 }]]);
      const state = await tokenService.getUserAuthState(1);
      expect(state).toEqual({ found: true, passwordUpdatedAt: changedAt, isDemo: true });
    });

    it('throws (fail-closed) when the state lookup fails in the database', async () => {
      db.query.mockRejectedValueOnce(new Error('db down'));

      await expect(tokenService.getUserAuthState(1)).rejects.toMatchObject({
        message: 'USER_STATE_CHECK_FAILED',
      });
    });
  });

  describe('cleanupExpiredRevokedTokens', () => {
    it('reports success when the purge query runs', async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 3 }]);
      const ok = await tokenService.cleanupExpiredRevokedTokens();
      expect(ok).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM revoked_tokens WHERE revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
      );
    });

    it('reports failure instead of throwing when the purge fails', async () => {
      db.query.mockRejectedValueOnce(new Error('db down'));
      const ok = await tokenService.cleanupExpiredRevokedTokens();
      expect(ok).toBe(false);
    });
  });
});
