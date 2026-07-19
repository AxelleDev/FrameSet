const { getCookieValue } = require('../../src/utils/cookies.utils');

describe('cookies utils — getCookieValue', () => {
  it('decodes a URL-encoded cookie value', () => {
    const req = { headers: { cookie: 'frameset_csrf_token=abc%20def; other=1' } };
    expect(getCookieValue(req, 'frameset_csrf_token')).toBe('abc def');
  });

  it('returns the raw value instead of throwing on a malformed encoding', () => {
    // A stray "%" makes decodeURIComponent throw; that must not 500 the request.
    const req = { headers: { cookie: 'frameset_csrf_token=%zz%' } };
    expect(getCookieValue(req, 'frameset_csrf_token')).toBe('%zz%');
  });

  it('returns null when the cookie is absent', () => {
    expect(getCookieValue({ headers: { cookie: 'a=1' } }, 'missing')).toBeNull();
  });

  it('returns null without a cookie header', () => {
    expect(getCookieValue({ headers: {} }, 'frameset_csrf_token')).toBeNull();
  });
});
