process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({ verifyIdToken: mockVerifyIdToken })),
}));
jest.mock('../../src/database');
jest.mock('../../src/services/mail.service');
jest.mock('../../src/services/token.service');

const authController = require('../../src/controllers/auth.controller');
const db = require('../../src/database');
const mailService = require('../../src/services/mail.service');
const tokenService = require('../../src/services/token.service');

const stubGooglePayload = (payload) => {
  mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => payload });
};

const makeRes = () => ({
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

describe('auth controller — Google sign-in', () => {
  beforeEach(() => {
    // clearAllMocks (not resetAllMocks): the OAuth2Client factory implementation
    // set in jest.mock above must survive between tests.
    jest.clearAllMocks();
    tokenService.generateRefreshToken.mockReturnValue('refreshToken');
  });

  it('signs in an existing Google-linked account and sets the auth cookies', async () => {
    stubGooglePayload({ sub: 'g-123', email: 'jane@example.com', email_verified: true });
    db.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          name: 'Jane Doe',
          email: 'jane@example.com',
          avatar_initials: 'JD',
          password_updated_at: null,
          pending_email: null,
          has_password: 0,
        },
      ],
    ]);

    const req = { body: { credential: 'google-id-token' } };
    const res = makeRes();
    await authController.googleSignIn(req, res);

    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'google-id-token',
      audience: 'test-client-id.apps.googleusercontent.com',
    });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE google_id = ?'), [
      'g-123',
    ]);
    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, id: 1, hasPassword: false }),
    );
  });

  it('links an existing account with the same verified email and alerts the owner', async () => {
    stubGooglePayload({ sub: 'g-123', email: 'jane@example.com', email_verified: true });
    db.query
      .mockResolvedValueOnce([[]]) // no google_id match
      .mockResolvedValueOnce([
        [
          {
            id: 7,
            name: 'Jane Doe',
            email: 'jane@example.com',
            avatar_initials: 'JD',
            password_updated_at: new Date(),
            pending_email: null,
            has_password: 1,
          },
        ],
      ]) // email match
      .mockResolvedValueOnce([{}]); // link UPDATE

    const req = { body: { credential: 'google-id-token' } };
    const res = makeRes();
    await authController.googleSignIn(req, res);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET google_id = ?'), [
      'g-123',
      7,
    ]);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, id: 7, hasPassword: true }),
    );
    // The owner is alerted that a sign-in method was added (fire-and-forget send).
    expect(mailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: 'Google sign-in was added to your account',
      }),
    );
  });

  it('creates a new, already-verified, passwordless account on first sign-in', async () => {
    stubGooglePayload({
      sub: 'g-456',
      email: 'new@example.com',
      email_verified: true,
      name: 'New User',
    });
    db.query
      .mockResolvedValueOnce([[]]) // no google_id match
      .mockResolvedValueOnce([[]]) // no email match
      .mockResolvedValueOnce([{ insertId: 42 }]); // INSERT

    const req = { body: { credential: 'google-id-token' } };
    const res = makeRes();
    await authController.googleSignIn(req, res);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), [
      'New User',
      'new@example.com',
      'N',
      'g-456',
    ]);
    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        id: 42,
        email: 'new@example.com',
        hasPassword: false,
      }),
    );
  });

  it('rejects a Google identity whose email Google has not verified', async () => {
    stubGooglePayload({ sub: 'g-1', email: 'x@y.com', email_verified: false });

    const req = { body: { credential: 'google-id-token' } };
    const res = makeRes();
    await authController.googleSignIn(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.query).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects an invalid Google token with a generic 401', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid signature'));

    const req = { body: { credential: 'tampered-token' } };
    const res = makeRes();
    await authController.googleSignIn(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Google sign-in failed. Please try again.' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects a missing credential with a 400', async () => {
    const req = { body: {} };
    const res = makeRes();
    await authController.googleSignIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });
});
