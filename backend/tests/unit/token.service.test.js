jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'token'),
  verify: jest.fn(() => ({ id: 1 }))
}));
const jwt = require('jsonwebtoken');
const tokenService = require('../../src/services/token.service');

describe('token.service', () => {
  it('should generate refresh token', () => {
    jwt.sign.mockReturnValue('token');
    const token = tokenService.generateRefreshToken({ id: 1 });
    expect(token).toBe('token');
  });

  it('should verify refresh token', () => {
    jwt.verify.mockReturnValue({ id: 1 });
    const payload = tokenService.verifyRefreshToken('token');
    expect(payload).toEqual({ id: 1 });
  });

  it('should return null for invalid token', () => {
    jwt.verify.mockImplementation(() => { throw new Error('fail'); });
    const payload = tokenService.verifyRefreshToken('badtoken');
    expect(payload).toBeNull();
  });
});
