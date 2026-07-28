process.env.TOTP_ENCRYPTION_KEY =
  '20f766230f5b4740f5b620d2dde09488b110435c13395edb10e1fdcd5ddf2098';

const { encryptSecret, decryptSecret } = require('../../src/utils/encryption');

describe('encryption utils', () => {
  it('round-trips a plaintext secret', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    expect(encryptSecret(plaintext)).not.toBe(encryptSecret(plaintext));
  });

  it('rejects a tampered ciphertext instead of returning garbage', () => {
    const encrypted = encryptSecret('JBSWY3DPEHPK3PXP');
    const bytes = Buffer.from(encrypted, 'base64');
    bytes[bytes.length - 1] ^= 0xff; // flip a bit in the auth tag
    const tampered = bytes.toString('base64');

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('rejects a malformed (too-short) payload', () => {
    expect(() => decryptSecret(Buffer.from('short').toString('base64'))).toThrow(
      /Malformed encrypted payload/,
    );
  });
});
