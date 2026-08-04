/**
 * user.service profile flows: update validations, the staged pending-email
 * confirmation (expiry, wrong code, duplicate race) and the password-change
 * policy — each branch is a 4xx contract the frontend relies on.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';

const bcrypt = require('bcryptjs');
const userService = require('../../src/services/user.service');
const db = require('../../src/database');
const { hashOtp } = require('../../src/utils/otp');

jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');
jest.mock('../../src/services/googleIdentity.service');

describe('updateUserProfile validations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const expectValidation = async (payload, message) => {
    await expect(userService.updateUserProfile(1, payload)).rejects.toMatchObject({
      code: 'validation',
      message,
    });
    expect(db.query).not.toHaveBeenCalled();
  };

  it('requires both name and email', async () => {
    await expectValidation({ name: '', email: 'a@b.com' }, 'All fields are required.');
    await expectValidation({ name: 'Axelle', email: '' }, 'All fields are required.');
  });

  it('caps the name at 255 chars and validates the email format', async () => {
    await expectValidation({ name: 'x'.repeat(256), email: 'a@b.com' }, 'Name is too long.');
    await expectValidation({ name: 'Axelle', email: 'not-an-email' }, 'Invalid email.');
  });

  it('throws not_found for an unknown user', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await expect(
      userService.updateUserProfile(999, { name: 'Axelle', email: 'a@b.com' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects an email change when the target email already belongs to someone', async () => {
    const hashed = await bcrypt.hash('Correct1', 4);
    db.query
      .mockResolvedValueOnce([
        [{ email: 'old@b.com', pending_email: null, password: hashed, google_id: null }],
      ])
      .mockResolvedValueOnce([[{ id: 2 }]]); // someone else owns new@b.com

    await expect(
      userService.updateUserProfile(1, {
        name: 'Axelle',
        email: 'new@b.com',
        currentPassword: 'Correct1',
      }),
    ).rejects.toMatchObject({ code: 'email_in_use' });
  });
});

describe('confirmPendingEmail', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const pendingRow = (over = {}) => ({
    id: 1,
    name: 'Axelle',
    email: 'old@b.com',
    pending_email: 'new@b.com',
    pending_email_code: hashOtp('123456'),
    pending_email_expires: new Date(Date.now() + 60_000),
    avatar_initials: 'A',
    password_updated_at: null,
    ...over,
  });

  it('throws no_pending when nothing is staged for this email', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await expect(
      userService.confirmPendingEmail(1, { email: 'new@b.com', code: '123456' }),
    ).rejects.toMatchObject({ code: 'no_pending' });
  });

  it('throws code_expired past the expiry timestamp', async () => {
    db.query.mockResolvedValueOnce([
      [pendingRow({ pending_email_expires: new Date(Date.now() - 1000) })],
    ]);
    await expect(
      userService.confirmPendingEmail(1, { email: 'new@b.com', code: '123456' }),
    ).rejects.toMatchObject({ code: 'code_expired' });
  });

  it('throws invalid_code for a wrong code', async () => {
    db.query.mockResolvedValueOnce([[pendingRow()]]);
    await expect(
      userService.confirmPendingEmail(1, { email: 'new@b.com', code: '654321' }),
    ).rejects.toMatchObject({ code: 'invalid_code' });
  });

  it('maps a duplicate-key race on commit to email_in_use', async () => {
    const dup = new Error('dup');
    dup.code = 'ER_DUP_ENTRY';
    db.query.mockResolvedValueOnce([[pendingRow()]]).mockRejectedValueOnce(dup);

    await expect(
      userService.confirmPendingEmail(1, { email: 'new@b.com', code: '123456' }),
    ).rejects.toMatchObject({ code: 'email_in_use' });
  });
});

describe('changeUserPassword policy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const expectValidation = async (payload, pattern) => {
    await expect(userService.changeUserPassword(1, payload)).rejects.toMatchObject({
      code: 'validation',
      message: expect.stringMatching(pattern),
    });
  };

  it('requires both passwords as strings', async () => {
    await expectValidation({ currentPassword: '', newPassword: 'N3wPassword!' }, /Required/);
    await expectValidation({ currentPassword: 'x', newPassword: null }, /Required/);
    await expectValidation({ currentPassword: { a: 1 }, newPassword: 'N3wPassword!' }, /Required/);
  });

  it('enforces minimum length and complexity on the new password', async () => {
    await expectValidation({ currentPassword: 'Old1', newPassword: 'Ab1' }, /too short/i);
    await expectValidation(
      { currentPassword: 'Old1', newPassword: 'alllowercase1' },
      /uppercase|complexity|letter/i,
    );
  });

  it('rejects a wrong current password without touching the stored hash', async () => {
    const hashed = await bcrypt.hash('Correct1', 4);
    db.query.mockResolvedValueOnce([[{ email: 'a@b.com', password: hashed }]]);

    await expect(
      userService.changeUserPassword(1, {
        currentPassword: 'Wrong1',
        newPassword: 'N3wPassword!',
      }),
    ).rejects.toMatchObject({ code: 'invalid_current_password' });
    // Only the SELECT ran — no UPDATE.
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
