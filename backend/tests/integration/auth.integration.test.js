process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'integration_jwt_refresh_secret';
process.env.TOTP_ENCRYPTION_KEY =
  process.env.TOTP_ENCRYPTION_KEY ||
  '20f766230f5b4740f5b620d2dde09488b110435c13395edb10e1fdcd5ddf2098';

jest.mock('../../src/services/mail.service', () => ({
  sendMail: jest.fn().mockResolvedValue(true),
  buildTemplate: jest.fn(() => '<p>template</p>'),
}));

// Fixed verification code so the test knows the plaintext: only its SHA-256 hash
// is stored in the (mocked) DB.
jest.mock('../../src/utils/auth.utils', () => ({
  ...jest.requireActual('../../src/utils/auth.utils'),
  generateVerificationCode: () => ({
    code: '135790',
    expires: new Date(Date.now() + 10 * 60 * 1000),
  }),
}));

jest.mock('../../src/database', () => {
  let users = [];
  let revokedTokens = [];
  let nextUserId = 1;

  const query = jest.fn(async (sql, params = []) => {
    const normalizedSql = String(sql).trim().replace(/\s+/g, ' ');

    if (normalizedSql.startsWith('INSERT INTO users ')) {
      const [
        name,
        email,
        password,
        avatarInitials,
        isVerified,
        verificationCode,
        verificationCodeExpires,
        passwordUpdatedAt,
      ] = params;

      const duplicate = users.find((user) => user.email === email);
      if (duplicate) {
        const duplicateError = new Error('Duplicate entry');
        duplicateError.code = 'ER_DUP_ENTRY';
        throw duplicateError;
      }

      const insertedUser = {
        id: nextUserId,
        name,
        email,
        password,
        avatar_initials: avatarInitials,
        is_verified: Boolean(isVerified),
        verification_code: verificationCode,
        verification_code_expires: verificationCodeExpires,
        password_updated_at: passwordUpdatedAt,
        pending_email: null,
        pending_email_code: null,
        pending_email_expires: null,
      };

      users.push(insertedUser);
      nextUserId += 1;

      return [{ insertId: insertedUser.id }];
    }

    // Matches any column projection of a lookup by email (the services select
    // explicit columns; the in-memory row carries them all, so we return it whole).
    if (/^SELECT .+ FROM users WHERE email = \?$/.test(normalizedSql)) {
      const [email] = params;
      const foundUsers = users.filter((user) => user.email === email);
      return [foundUsers];
    }

    if (
      normalizedSql ===
      'UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL, otp_attempts = 0 WHERE email = ?'
    ) {
      const [email] = params;
      const user = users.find((item) => item.email === email);

      if (!user) {
        return [{ affectedRows: 0 }];
      }

      user.is_verified = true;
      user.verification_code = null;
      user.verification_code_expires = null;

      return [{ affectedRows: 1 }];
    }

    if (
      normalizedSql ===
      'SELECT id, name, email, avatar_initials, password_updated_at, pending_email, is_demo, totp_enabled, (password IS NOT NULL) AS has_password FROM users WHERE id = ?'
    ) {
      const [id] = params;
      const user = users.find((item) => item.id === id);

      if (!user) {
        return [[]];
      }

      return [
        [
          {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar_initials: user.avatar_initials,
            password_updated_at: user.password_updated_at,
            pending_email: user.pending_email,
            is_demo: user.is_demo ? 1 : 0,
            totp_enabled: user.totp_enabled ? 1 : 0,
            has_password: user.password === null ? 0 : 1,
          },
        ],
      ];
    }

    if (normalizedSql === 'INSERT IGNORE INTO revoked_tokens (user_id, token) VALUES (?, ?)') {
      const [userId, tokenHash] = params;
      const exists = revokedTokens.some(
        (token) => token.user_id === userId && token.token === tokenHash,
      );

      if (!exists) {
        revokedTokens.push({
          id: revokedTokens.length + 1,
          user_id: userId,
          token: tokenHash,
          revoked_at: new Date(),
        });
      }

      return [{ affectedRows: exists ? 0 : 1 }];
    }

    if (normalizedSql === 'SELECT id FROM revoked_tokens WHERE user_id = ? AND token = ? LIMIT 1') {
      const [userId, tokenHash] = params;
      const found = revokedTokens.find(
        (token) => token.user_id === userId && token.token === tokenHash,
      );
      return [found ? [{ id: found.id }] : []];
    }

    if (normalizedSql === 'SELECT password_updated_at FROM users WHERE id = ? LIMIT 1') {
      const [id] = params;
      const user = users.find((item) => item.id === id);
      return [user ? [{ password_updated_at: user.password_updated_at }] : []];
    }

    // Merged read used by authenticateToken (see token.service.getUserAuthState):
    // one query covers both the password-staleness check and the demo
    // read-only check, instead of the two separate queries above/below.
    if (normalizedSql === 'SELECT password_updated_at, is_demo FROM users WHERE id = ? LIMIT 1') {
      const [id] = params;
      const user = users.find((item) => item.id === id);
      return [
        user
          ? [{ password_updated_at: user.password_updated_at, is_demo: user.is_demo ? 1 : 0 }]
          : [],
      ];
    }

    throw new Error(`Unhandled SQL in auth integration test: ${normalizedSql}`);
  });

  const __reset = () => {
    users = [];
    revokedTokens = [];
    nextUserId = 1;
    query.mockClear();
  };

  const __getUsers = () => users;
  const __getRevokedTokens = () => revokedTokens;

  return {
    query,
    __reset,
    __getUsers,
    __getRevokedTokens,
  };
});

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database');

describe('integration auth flow', () => {
  beforeEach(() => {
    db.__reset();
    jest.clearAllMocks();
  });

  it('should run register verify login profile logout via real HTTP routes and middleware chain', async () => {
    const agent = request.agent(app);

    const csrfResponse = await agent.get('/api/auth/csrf-token');
    expect(csrfResponse.status).toBe(200);
    expect(typeof csrfResponse.body.csrfToken).toBe('string');
    expect(csrfResponse.body.csrfToken.length).toBeGreaterThan(10);

    const csrfToken = csrfResponse.body.csrfToken;
    const payload = {
      name: 'Alice Martin',
      email: 'alice.integration@example.com',
      password: 'Passw0rdA',
    };

    const registerResponse = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send(payload);

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        email: payload.email,
        isVerified: false,
      }),
    );

    const [createdUser] = db.__getUsers();
    expect(createdUser).toBeDefined();
    expect(createdUser.email).toBe(payload.email);
    // The stored code is the SHA-256 hash, never the plaintext.
    expect(createdUser.verification_code).toBeTruthy();
    expect(createdUser.verification_code).not.toBe('135790');

    const verifyResponse = await agent
      .post('/api/auth/verify')
      .set('x-csrf-token', csrfToken)
      .send({
        email: payload.email,
        code: '135790',
      });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body).toEqual(expect.objectContaining({ success: true }));

    const loginResponse = await agent.post('/api/auth/login').set('x-csrf-token', csrfToken).send({
      email: payload.email,
      password: payload.password,
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        email: payload.email,
      }),
    );
    expect(loginResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^frameset_access_token=/),
        expect.stringMatching(/^frameset_refresh_token=/),
      ]),
    );

    const profileResponse = await agent.get('/api/users/profile');
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body).toEqual(
      expect.objectContaining({
        email: payload.email,
        name: payload.name,
      }),
    );

    const logoutResponse = await agent
      .post('/api/auth/logout')
      .set('x-csrf-token', csrfToken)
      .send({});

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toEqual(expect.objectContaining({ success: true }));
    expect(db.__getRevokedTokens().length).toBeGreaterThanOrEqual(1);
  });
});
