jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, secret, cb) => cb(null, { id: 1 }))
}));
const authenticateToken = require('../../src/middleware/authenticateToken');
const tokenService = require('../../src/services/token.service');

jest.mock('../../src/services/token.service');

describe('authenticateToken middleware', () => {
  const authenticateToken = require('../../src/middleware/authenticateToken');
  jest.mock('jsonwebtoken', () => ({
    verify: jest.fn((token, secret, cb) => cb(null, { id: 1 }))
  }));
  const jwt = require('jsonwebtoken');

  it('should return 401 if token missing', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token manquant' });
  });

  it('should return 403 if token invalid', () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    jwt.verify.mockImplementation((token, secret, cb) => cb(true));
    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token invalide ou expiré' });
  });

  it('should call next if token valid', () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    jwt.verify.mockImplementation((token, secret, cb) => cb(null, { id: 1 }));
    authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 1 });
  });
});
