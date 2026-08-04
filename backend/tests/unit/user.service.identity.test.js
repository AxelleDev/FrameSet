/**
 * verifyUserIdentity — the re-authentication gate in front of every critical
 * account action (email change, deletion, 2FA changes, recovery-code
 * rotation). Each branch here is a security decision, so each one gets a
 * test: password accounts, Google-only accounts, and the fail-closed default.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';

const bcrypt = require('bcryptjs');
const { verifyUserIdentity } = require('../../src/services/user.service');
const { verifyGoogleIdToken } = require('../../src/services/googleIdentity.service');

jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');
jest.mock('../../src/services/googleIdentity.service');

describe('verifyUserIdentity', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('password accounts', () => {
    let userDb;
    beforeAll(async () => {
      userDb = { password: await bcrypt.hash('Correct1', 4), google_id: null };
    });

    it('passes with the correct current password', async () => {
      await expect(
        verifyUserIdentity(userDb, { currentPassword: 'Correct1' }),
      ).resolves.toBeUndefined();
    });

    it('demands the password when it is missing or blank', async () => {
      await expect(verifyUserIdentity(userDb, {})).rejects.toMatchObject({
        code: 'reauth_required',
      });
      await expect(verifyUserIdentity(userDb, { currentPassword: '   ' })).rejects.toMatchObject({
        code: 'reauth_required',
      });
      // A non-string (e.g. an object smuggled through JSON) is refused too.
      await expect(
        verifyUserIdentity(userDb, { currentPassword: { $ne: '' } }),
      ).rejects.toMatchObject({ code: 'reauth_required' });
    });

    it('rejects a wrong password', async () => {
      await expect(verifyUserIdentity(userDb, { currentPassword: 'Wrong1' })).rejects.toMatchObject(
        { code: 'invalid_current_password' },
      );
    });
  });

  describe('Google-only accounts', () => {
    const userDb = { password: null, google_id: 'google-uid-1' };

    it('passes when Google confirms the same linked identity', async () => {
      verifyGoogleIdToken.mockResolvedValueOnce({ status: 'ok', googleId: 'google-uid-1' });
      await expect(
        verifyUserIdentity(userDb, { googleCredential: 'fresh-id-token' }),
      ).resolves.toBeUndefined();
    });

    it('demands a credential when none is provided', async () => {
      await expect(verifyUserIdentity(userDb, {})).rejects.toMatchObject({
        code: 'reauth_required',
      });
    });

    it('rejects a credential for a DIFFERENT Google account (no account swapping)', async () => {
      verifyGoogleIdToken.mockResolvedValueOnce({ status: 'ok', googleId: 'someone-else' });
      await expect(
        verifyUserIdentity(userDb, { googleCredential: 'other-token' }),
      ).rejects.toMatchObject({ code: 'reauth_failed' });
    });

    it('rejects when Google itself refuses the token', async () => {
      verifyGoogleIdToken.mockResolvedValueOnce({ status: 'invalid' });
      await expect(
        verifyUserIdentity(userDb, { googleCredential: 'bad-token' }),
      ).rejects.toMatchObject({ code: 'reauth_failed' });
    });
  });

  it('fails closed for an account with neither password nor Google identity', async () => {
    await expect(
      verifyUserIdentity({ password: null, google_id: null }, { currentPassword: 'x' }),
    ).rejects.toMatchObject({ code: 'reauth_required' });
  });
});
