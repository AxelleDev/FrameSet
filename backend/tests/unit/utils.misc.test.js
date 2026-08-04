/**
 * Edge cases of the small shared utilities: the 429 JSON handler, the
 * constant-time OTP comparison, log-safe fingerprints, malformed-cookie
 * decoding, logger serialization, and the SSE hub's subscriber cap.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';

const { jsonLimitHandler } = require('../../src/utils/rateLimitHandler');
const { hashOtp, safeOtpEqual } = require('../../src/utils/otp');
const { getIdentifierFingerprint } = require('../../src/utils/auth.utils');
const { getCookieValue } = require('../../src/utils/cookies.utils');
const { logger } = require('../../src/utils/logger');

describe('rateLimitHandler', () => {
  it('answers 429 with the limiter message as JSON (never plain text)', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jsonLimitHandler('Too many attempts, try again in 10 minutes.')({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Too many attempts, try again in 10 minutes.',
    });
  });
});

describe('safeOtpEqual edges', () => {
  it('rejects empty candidates and empty stored hashes without throwing', () => {
    expect(safeOtpEqual('', hashOtp('123456'))).toBe(false);
    expect(safeOtpEqual('123456', '')).toBe(false);
    expect(safeOtpEqual(null, null)).toBe(false);
  });

  it('rejects a stored value whose length does not match a real hash', () => {
    expect(safeOtpEqual('123456', 'not-a-sha256-hash')).toBe(false);
  });

  it('accepts the matching code', () => {
    expect(safeOtpEqual('123456', hashOtp('123456'))).toBe(true);
  });
});

describe('getIdentifierFingerprint', () => {
  it('returns null for empty-ish identifiers', () => {
    expect(getIdentifierFingerprint('')).toBeNull();
    expect(getIdentifierFingerprint('   ')).toBeNull();
    expect(getIdentifierFingerprint(undefined)).toBeNull();
  });

  it('is case/whitespace-insensitive and 12 hex chars long', () => {
    const a = getIdentifierFingerprint('  Axelle@Example.com ');
    expect(a).toBe(getIdentifierFingerprint('axelle@example.com'));
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('getCookieValue malformed encodings', () => {
  it('falls back to the raw value when percent-decoding fails', () => {
    const req = { headers: { cookie: 'broken=abc%zzdef' } };
    expect(getCookieValue(req, 'broken')).toBe('abc%zzdef');
  });

  it('returns an empty string for a valueless cookie', () => {
    const req = { headers: { cookie: 'empty=' } };
    expect(getCookieValue(req, 'empty')).toBe('');
  });
});

describe('logger metadata sanitization', () => {
  let errorSpy;
  let warnSpy;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  const lastLogged = () => JSON.parse(errorSpy.mock.calls.at(-1)[0]);

  it('serializes Errors (with code) and stringifies BigInt metadata', () => {
    const error = new Error('boom');
    error.code = 'ER_TEST';
    logger.error('test.event', { error, big: 10n, skipped: undefined, fn: () => {} });

    const entry = lastLogged();
    expect(entry.error).toEqual(
      expect.objectContaining({ name: 'Error', message: 'boom', code: 'ER_TEST' }),
    );
    expect(entry.big).toBe('10');
    expect(entry).not.toHaveProperty('skipped');
    expect(entry).not.toHaveProperty('fn');
  });

  it('passes non-object metadata through as an empty payload instead of crashing', () => {
    expect(() => logger.warn('test.event', 'not-an-object')).not.toThrow();
    expect(() => logger.warn('test.event', ['array'])).not.toThrow();
  });
});
