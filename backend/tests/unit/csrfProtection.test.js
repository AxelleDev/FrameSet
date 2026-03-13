const { ensureCsrfCookie, csrfProtection } = require('../../src/middleware/csrfProtection');
const { CSRF_TOKEN_COOKIE_NAME } = require('../../src/utils/cookies.utils');

describe('middleware csrfProtection', () => {
  it('devrait definir un cookie CSRF si absent', () => {
    const req = { headers: {}, method: 'GET' };
    const res = { cookie: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    ensureCsrfCookie(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_TOKEN_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: false })
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ne devrait pas redefinir le cookie CSRF si deja present', () => {
    const req = { headers: { cookie: `${CSRF_TOKEN_COOKIE_NAME}=existing-token` }, method: 'GET' };
    const res = { cookie: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    ensureCsrfCookie(req, res, next);

    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('devrait autoriser les methodes safe', () => {
    const req = { headers: {}, method: 'GET' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('devrait refuser une requete mutante sans token CSRF valide', () => {
    const req = {
      method: 'POST',
      headers: {
        cookie: `${CSRF_TOKEN_COOKIE_NAME}=cookie-token`
      }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Requete CSRF invalide' });
    expect(next).not.toHaveBeenCalled();
  });

  it('devrait autoriser une requete mutante avec token CSRF valide', () => {
    const req = {
      method: 'PATCH',
      headers: {
        cookie: `${CSRF_TOKEN_COOKIE_NAME}=shared-token`,
        'x-csrf-token': 'shared-token'
      }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
