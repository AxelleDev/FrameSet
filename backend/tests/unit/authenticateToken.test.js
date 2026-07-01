process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(() => ({ id: 1 }))
}));

jest.mock('../../src/services/token.service', () => ({
  isTokenRevoked: jest.fn().mockResolvedValue(false),
  isTokenStaleByPasswordChange: jest.fn().mockResolvedValue(false)
}));

const jwt = require('jsonwebtoken');
const tokenService = require('../../src/services/token.service');
const authenticateToken = require('../../src/middleware/authenticateToken');

describe('middleware authenticateToken', () => {

  beforeEach(() => {
    jest.resetAllMocks();
    jwt.verify.mockReturnValue({ id: 1 });
    tokenService.isTokenRevoked.mockResolvedValue(false);
    tokenService.isTokenStaleByPasswordChange.mockResolvedValue(false);
  });

  it('returns 401 when the token is missing', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing token' });
  });

  it('returns 403 when the token is invalid', async () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  it('returns 403 when the token is revoked', async () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    tokenService.isTokenRevoked.mockResolvedValue(true);

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the password changed after the token was issued', async () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    tokenService.isTokenStaleByPasswordChange.mockResolvedValue(true);

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid token', async () => {
    const req = { headers: { authorization: 'Bearer validtoken' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 1 });
    expect(req.token).toBe('validtoken');
  });

  it('returns 503 when the revocation check fails', async () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    tokenService.isTokenRevoked.mockRejectedValueOnce(new Error('db down'));

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Service temporarily unavailable' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid token from the HttpOnly cookie', async () => {
    const req = { headers: { cookie: 'frameset_access_token=cookie-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 1 });
    expect(req.token).toBe('cookie-token');
  });
});
