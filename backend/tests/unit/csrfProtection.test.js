// cookies.utils now derives ACCESS_TOKEN_MAX_AGE_MS from jwt.config (so the
// cookie's maxAge and the JWT's own expiry can never drift apart), which
// validates these at import time.
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';
process.env.TOTP_ENCRYPTION_KEY =
  '20f766230f5b4740f5b620d2dde09488b110435c13395edb10e1fdcd5ddf2098';

const { ensureCsrfCookie, csrfProtection } = require('../../src/middleware/csrfProtection');
const { CSRF_TOKEN_COOKIE_NAME } = require('../../src/utils/cookies.utils');

describe('middleware csrfProtection', () => {
  it('sets a CSRF cookie when it is missing', () => {
    const req = { headers: {}, method: 'GET' };
    const res = { cookie: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    ensureCsrfCookie(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_TOKEN_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: false }),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not reset the CSRF cookie when it is already present', () => {
    const req = { headers: { cookie: `${CSRF_TOKEN_COOKIE_NAME}=existing-token` }, method: 'GET' };
    const res = { cookie: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    ensureCsrfCookie(req, res, next);

    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows safe methods', () => {
    const req = { headers: {}, method: 'GET' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a mutating request without a valid CSRF token', () => {
    const req = {
      method: 'POST',
      headers: {
        cookie: `${CSRF_TOKEN_COOKIE_NAME}=cookie-token`,
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid CSRF request.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a mutating request with a valid CSRF token', () => {
    const req = {
      method: 'PATCH',
      headers: {
        cookie: `${CSRF_TOKEN_COOKIE_NAME}=shared-token`,
        'x-csrf-token': 'shared-token',
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
