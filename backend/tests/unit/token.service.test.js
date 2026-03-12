process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'token'),
  verify: jest.fn(() => ({ id: 1 }))
}));
const jwt = require('jsonwebtoken');
const tokenService = require('../../src/services/token.service');

describe('service de jeton', () => {
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
});
