process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'integration_jwt_refresh_secret';

jest.mock('../../src/services/mail.service', () => ({
  sendMail: jest.fn().mockResolvedValue(true),
  buildTemplate: jest.fn(() => '<p>template</p>')
}));

jest.mock('../../src/database', () => {
  let users = [];
  let revokedTokens = [];
  let nextUserId = 1;

  const query = jest.fn(async (sql, params = []) => {
    const normalizedSql = String(sql).trim().replace(/\s+/g, ' ');

    if (normalizedSql.startsWith('INSERT INTO users ')) {
      const [name, email, password, avatarInitials, isVerified, verificationCode, verificationCodeExpires, passwordUpdatedAt] = params;

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
        pending_email_expires: null
      };

      users.push(insertedUser);
      nextUserId += 1;

      return [{ insertId: insertedUser.id }];
    }

    if (normalizedSql === 'SELECT * FROM users WHERE email = ?') {
      const [email] = params;
      const foundUsers = users.filter((user) => user.email === email);
      return [foundUsers];
    }

    if (normalizedSql === 'UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL WHERE email = ?') {
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

    if (normalizedSql === 'SELECT id, name, email, avatar_initials, password_updated_at, pending_email FROM users WHERE id = ?') {
      const [id] = params;
      const user = users.find((item) => item.id === id);

      if (!user) {
        return [[]];
      }

      return [[{
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_initials: user.avatar_initials,
        password_updated_at: user.password_updated_at,
        pending_email: user.pending_email
      }]];
    }

    if (normalizedSql === 'INSERT IGNORE INTO revoked_tokens (user_id, token) VALUES (?, ?)') {
      const [userId, tokenHash] = params;
      const exists = revokedTokens.some((token) => token.user_id === userId && token.token === tokenHash);

      if (!exists) {
        revokedTokens.push({
          id: revokedTokens.length + 1,
          user_id: userId,
          token: tokenHash,
          revoked_at: new Date()
        });
      }

      return [{ affectedRows: exists ? 0 : 1 }];
    }

    if (normalizedSql === 'SELECT id FROM revoked_tokens WHERE user_id = ? AND token = ? LIMIT 1') {
      const [userId, tokenHash] = params;
      const found = revokedTokens.find((token) => token.user_id === userId && token.token === tokenHash);
      return [found ? [{ id: found.id }] : []];
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
    __getRevokedTokens
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
      password: 'Passw0rdA'
    };

    const registerResponse = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send(payload);

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body).toEqual(expect.objectContaining({
      success: true,
      email: payload.email,
      is_verified: false
    }));

    const [createdUser] = db.__getUsers();
    expect(createdUser).toBeDefined();
    expect(createdUser.email).toBe(payload.email);
    expect(createdUser.verification_code).toBeTruthy();

    const verifyResponse = await agent
      .post('/api/auth/verify')
      .set('x-csrf-token', csrfToken)
      .send({
        email: payload.email,
        code: createdUser.verification_code
      });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body).toEqual(expect.objectContaining({ success: true }));

    const loginResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({
        email: payload.email,
        password: payload.password
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toEqual(expect.objectContaining({
      success: true,
      email: payload.email
    }));
    expect(loginResponse.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringMatching(/^frameset_access_token=/),
      expect.stringMatching(/^frameset_refresh_token=/)
    ]));

    const profileResponse = await agent.get('/api/users/profile');
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body).toEqual(expect.objectContaining({
      email: payload.email,
      name: payload.name
    }));

    const logoutResponse = await agent
      .post('/api/auth/logout')
      .set('x-csrf-token', csrfToken)
      .send({});

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toEqual(expect.objectContaining({ success: true }));
    expect(db.__getRevokedTokens().length).toBeGreaterThanOrEqual(1);
  });
});
