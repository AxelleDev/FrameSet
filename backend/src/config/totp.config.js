const KEY_LENGTH_BYTES = 32; // AES-256 key size.

const rawKey = process.env.TOTP_ENCRYPTION_KEY;
if (!rawKey) {
  throw new Error('TOTP_ENCRYPTION_KEY must be defined in the environment variables');
}

const TOTP_ENCRYPTION_KEY = Buffer.from(rawKey, 'hex');
if (TOTP_ENCRYPTION_KEY.length !== KEY_LENGTH_BYTES) {
  throw new Error(
    `TOTP_ENCRYPTION_KEY must be a ${KEY_LENGTH_BYTES * 2}-character hex string (${KEY_LENGTH_BYTES} bytes)`,
  );
}

module.exports = { TOTP_ENCRYPTION_KEY };
