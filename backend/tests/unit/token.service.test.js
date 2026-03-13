process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';

const { createHash } = require('crypto');

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'token'),
  verify: jest.fn(() => ({ id: 1 }))
}));
jest.mock('../../src/database', () => ({
  query: jest.fn()
}));

const jwt = require('jsonwebtoken');
const db = require('../../src/database');
const tokenService = require('../../src/services/token.service');

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

describe('service de jeton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devrait générer un jeton de rafraîchissement', () => {
    jwt.sign.mockReturnValue('token');
    const token = tokenService.generateRefreshToken({ id: 1 });
    expect(token).toBe('token');
  });

  it('devrait vérifier le jeton de rafraîchissement', () => {
    jwt.verify.mockReturnValue({ id: 1 });
    const payload = tokenService.verifyRefreshToken('token');
    expect(payload).toEqual({ id: 1 });
  });

  it('devrait retourner null pour un jeton invalide', () => {
    jwt.verify.mockImplementation(() => { throw new Error('fail'); });
    const payload = tokenService.verifyRefreshToken('badtoken');
    expect(payload).toBeNull();
  });

  it('devrait révoquer un token', async () => {
    db.query.mockResolvedValueOnce([{}]);
    const ok = await tokenService.revokeToken(1, 'abc');
    expect(ok).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO revoked_tokens (user_id, token) VALUES (?, ?)',
      [1, hashToken('abc')]
    );
  });

  it('devrait détecter un token révoqué', async () => {
    db.query.mockResolvedValueOnce([[{ id: 99 }]]);
    const revoked = await tokenService.isTokenRevoked(1, 'abc');
    expect(revoked).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      'SELECT id FROM revoked_tokens WHERE user_id = ? AND token = ? LIMIT 1',
      [1, hashToken('abc')]
    );
  });

  it('devrait retourner false pour un token non révoqué', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const revoked = await tokenService.isTokenRevoked(1, 'abc');
    expect(revoked).toBe(false);
  });

  it('devrait refuser de révoquer un token vide', async () => {
    const ok = await tokenService.revokeToken(1, '');
    expect(ok).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('devrait retourner false si le token à vérifier est vide', async () => {
    const revoked = await tokenService.isTokenRevoked(1, '');
    expect(revoked).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });
});
