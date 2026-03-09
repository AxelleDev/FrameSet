jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, secret, cb) => cb(null, { id: 1 }))
}));
const authenticateToken = require('../../src/middleware/authenticateToken');
const tokenService = require('../../src/services/token.service');

jest.mock('../../src/services/token.service');

describe('middleware authenticateToken', () => {
  const authenticateToken = require('../../src/middleware/authenticateToken');
  jest.mock('jsonwebtoken', () => ({
    verify: jest.fn((token, secret, cb) => cb(null, { id: 1 }))
  }));
  const jwt = require('jsonwebtoken');

  it('devrait retourner 401 si le jeton est manquant', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token manquant' });
  });

  it('devrait retourner 403 si le jeton est invalide', () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    jwt.verify.mockImplementation((token, secret, cb) => cb(true));
    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token invalide ou expiré' });
  });

  it('devrait appeler next si le jeton est valide', () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    jwt.verify.mockImplementation((token, secret, cb) => cb(null, { id: 1 }));
    authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 1 });
  });
});
