process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';

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
      [1, 'abc']
    );
  });

  it('devrait détecter un token révoqué', async () => {
    db.query.mockResolvedValueOnce([[{ id: 99 }]]);
    const revoked = await tokenService.isTokenRevoked(1, 'abc');
    expect(revoked).toBe(true);
  });

  it('devrait retourner false pour un token non révoqué', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const revoked = await tokenService.isTokenRevoked(1, 'abc');
    expect(revoked).toBe(false);
  });
});
