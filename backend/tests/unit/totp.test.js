const {
  generateTotpSecret,
  buildOtpauthUrl,
  generateTotpCode,
  matchTotpCode,
  verifyTotpCode,
  base32Encode,
  base32Decode,
} = require('../../src/utils/totp');

describe('totp utils', () => {
  describe('base32Encode / base32Decode', () => {
    // RFC 4648 §10 test vectors (unpadded, since generateTotpSecret never pads).
    const vectors = [
      ['', ''],
      ['f', 'MY'],
      ['fo', 'MZXQ'],
      ['foo', 'MZXW6'],
      ['foob', 'MZXW6YQ'],
      ['fooba', 'MZXW6YTB'],
      ['foobar', 'MZXW6YTBOI'],
    ];

    it.each(vectors)('encodes %j as %s', (input, expected) => {
      expect(base32Encode(Buffer.from(input, 'ascii'))).toBe(expected);
    });

    it('round-trips arbitrary bytes through encode then decode', () => {
      const original = Buffer.from([0, 1, 2, 255, 128, 64, 17, 8]);
      expect(base32Decode(base32Encode(original))).toEqual(original);
    });

    it('decodes lowercase input and tolerates "=" padding', () => {
      expect(base32Decode('mzxw6===')).toEqual(Buffer.from('foo', 'ascii'));
    });

    it('rejects a character outside the Base32 alphabet', () => {
      expect(() => base32Decode('01289')).toThrow(/Invalid Base32/);
    });
  });

  describe('generateTotpSecret', () => {
    it('generates a fresh, valid Base32 secret each time', () => {
      const first = generateTotpSecret();
      const second = generateTotpSecret();
      expect(first).not.toBe(second);
      // 20 bytes -> 32 Base32 characters (160 bits / 5 bits per character).
      expect(first).toHaveLength(32);
      expect(() => base32Decode(first)).not.toThrow();
    });
  });

  describe('buildOtpauthUrl', () => {
    it('builds a well-formed otpauth:// URI carrying the secret and account name', () => {
      const url = buildOtpauthUrl({
        secret: 'JBSWY3DPEHPK3PXP',
        accountName: 'axelle@example.com',
      });
      expect(url).toMatch(/^otpauth:\/\/totp\//);
      expect(url).toContain('FrameSet%3Aaxelle%40example.com');
      expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
      expect(url).toContain('issuer=FrameSet');
      expect(url).toContain('digits=6');
      expect(url).toContain('period=30');
    });

    it('honors a custom issuer', () => {
      const url = buildOtpauthUrl({
        secret: 'JBSWY3DPEHPK3PXP',
        accountName: 'a@b.com',
        issuer: 'Acme',
      });
      expect(url).toContain('issuer=Acme');
      expect(url).toContain('Acme%3Aa%40b.com');
    });
  });

  describe('generateTotpCode / verifyTotpCode', () => {
    // RFC 6238 Appendix B reference secret (ASCII "12345678901234567890",
    // Base32-encoded), used with the SHA1 test vectors from the same table.
    const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

    it.each([
      [59 * 1000, '287082'],
      [1111111109 * 1000, '081804'],
      [1111111111 * 1000, '050471'],
      [1234567890 * 1000, '005924'],
      [2000000000 * 1000, '279037'],
    ])('matches the RFC 6238 SHA1 vector at time %i', (atMs, expectedCode) => {
      expect(generateTotpCode(RFC_SECRET, { at: atMs })).toBe(expectedCode);
      expect(verifyTotpCode(RFC_SECRET, expectedCode, { at: atMs, window: 0 })).toBe(true);
    });

    it('generates the current code and verifies it against itself', () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      expect(verifyTotpCode(secret, code)).toBe(true);
    });

    it('rejects a wrong code', () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      const wrongCode = code === '000000' ? '111111' : '000000';
      expect(verifyTotpCode(secret, wrongCode)).toBe(false);
    });

    it('accepts a code from one step earlier (clock-drift tolerance)', () => {
      const secret = generateTotpSecret();
      const now = Date.now();
      const previousStepCode = generateTotpCode(secret, { at: now - 30_000 });
      expect(verifyTotpCode(secret, previousStepCode, { at: now })).toBe(true);
    });

    it('rejects a code far outside the drift window', () => {
      const secret = generateTotpSecret();
      const now = Date.now();
      const farCode = generateTotpCode(secret, { at: now - 5 * 60 * 1000 });
      expect(verifyTotpCode(secret, farCode, { at: now })).toBe(false);
    });

    it('rejects non-6-digit input without throwing', () => {
      const secret = generateTotpSecret();
      expect(verifyTotpCode(secret, '12345')).toBe(false);
      expect(verifyTotpCode(secret, 'abcdef')).toBe(false);
      expect(verifyTotpCode(secret, '')).toBe(false);
      expect(verifyTotpCode(secret, null)).toBe(false);
      expect(verifyTotpCode(secret, undefined)).toBe(false);
    });
  });

  describe('matchTotpCode', () => {
    it('returns the time-step counter the code was generated for', () => {
      const secret = generateTotpSecret();
      const at = 1234567890 * 1000;
      const code = generateTotpCode(secret, { at });
      expect(matchTotpCode(secret, code, { at })).toBe(Math.floor(at / 1000 / 30));
    });

    it("returns the drifted step's own counter, not the current one", () => {
      const secret = generateTotpSecret();
      const at = 1234567890 * 1000;
      const previousStepCode = generateTotpCode(secret, { at: at - 30_000 });
      expect(matchTotpCode(secret, previousStepCode, { at })).toBe(Math.floor(at / 1000 / 30) - 1);
    });

    it('returns null for a wrong or malformed code', () => {
      const secret = generateTotpSecret();
      const at = 1234567890 * 1000;
      const code = generateTotpCode(secret, { at });
      const wrongCode = code === '000000' ? '111111' : '000000';
      expect(matchTotpCode(secret, wrongCode, { at })).toBeNull();
      expect(matchTotpCode(secret, 'abcdef', { at })).toBeNull();
      expect(matchTotpCode(secret, null, { at })).toBeNull();
    });
  });
});
