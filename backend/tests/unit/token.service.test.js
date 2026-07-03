process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';

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
});
