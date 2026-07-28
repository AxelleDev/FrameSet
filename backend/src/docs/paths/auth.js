// Path docs — registration, sessions, 2FA challenge, password reset, CSRF.
const { CSRF_HEADER } = require('../shared');

module.exports = {
  '/api/auth/csrf-token': {
    get: {
      tags: ['Auth'],
      summary: 'Fetch a CSRF token (and set the CSRF cookie)',
      responses: {
        200: {
          description: 'CSRF token issued.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { csrfToken: { type: 'string' } } },
            },
          },
        },
      },
    },
  },
  '/api/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Create an account',
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email', 'password'],
              properties: {
                name: { type: 'string', example: 'Axelle' },
                email: { type: 'string', format: 'email' },
                password: {
                  type: 'string',
                  format: 'password',
                  description: 'Min 8 chars, ≥1 lowercase, ≥1 uppercase, ≥1 digit.',
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Account created.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Sign in (sets auth cookies)',
      description:
        'When the account has two-factor authentication enabled, no cookies are set yet: the ' +
        'response is `{ success, requiresTotp, challengeToken }` and the sign-in completes ' +
        'via /api/auth/login/totp.',
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description:
            'Signed in; sets `frameset_access_token` and `frameset_refresh_token` cookies.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/auth/login/totp': {
    post: {
      tags: ['Auth'],
      summary: 'Complete a 2FA-enabled sign-in (sets auth cookies)',
      description:
        'Second step of signing in when the account has two-factor authentication enabled: ' +
        '/api/auth/login (or /api/auth/google) returns `challengeToken` instead of a session ' +
        'once the first factor checks out, and this endpoint exchanges it (plus a live TOTP ' +
        'code, or a single-use recovery code) for the real session.',
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['challengeToken', 'code'],
              properties: {
                challengeToken: {
                  type: 'string',
                  description: 'The short-lived token returned by /api/auth/login.',
                },
                code: {
                  type: 'string',
                  description: 'A 6-digit TOTP code, or a dashed recovery code.',
                  example: '123456',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description:
            'Signed in; sets `frameset_access_token` and `frameset_refresh_token` cookies.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
        },
        401: { description: 'Incorrect TOTP/recovery code.' },
        403: { description: 'The challenge token is missing, invalid, or expired.' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/auth/demo-login': {
    post: {
      tags: ['Auth'],
      summary: 'Try without an account (sets auth cookies for the demo account)',
      description:
        'Signs in to a single shared, read-only demo account — no credentials needed. ' +
        'Every mutating request from that account is rejected with 403 before it reaches ' +
        'the database, regardless of endpoint.',
      parameters: [CSRF_HEADER],
      responses: {
        200: {
          description:
            'Signed in as the demo account; sets `frameset_access_token` and `frameset_refresh_token` cookies.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        503: { description: 'No demo account is seeded on this deployment.' },
      },
    },
  },
  '/api/auth/google': {
    post: {
      tags: ['Auth'],
      summary: 'Sign in with Google (sets auth cookies)',
      description:
        'Verifies a Google ID token (from Google Identity Services) and signs the user in, ' +
        'creating or linking the account as needed. When the account has two-factor ' +
        'authentication enabled, no cookies are set yet: the response is ' +
        '`{ success, requiresTotp, challengeToken }` and the sign-in completes via ' +
        '/api/auth/login/totp, exactly like a password sign-in. ' +
        'Returns 503 when Google sign-in is not configured.',
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['credential'],
              properties: {
                credential: {
                  type: 'string',
                  description: 'Google ID token issued by Google Identity Services.',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description:
            'Signed in; sets `frameset_access_token` and `frameset_refresh_token` cookies.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
        503: { description: 'Google sign-in is not configured on this deployment.' },
      },
    },
  },
  '/api/auth/verify': {
    post: {
      tags: ['Auth'],
      summary: 'Confirm an account with the emailed code',
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'code'],
              properties: {
                email: { type: 'string', format: 'email' },
                code: { type: 'string', example: '123456' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Verified.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/auth/resend-code': {
    post: {
      tags: ['Auth'],
      summary: 'Resend the verification code',
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email' } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Sent.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/auth/forgot-password': {
    post: {
      tags: ['Auth'],
      summary: 'Request a password-reset code',
      description:
        'Always responds identically whether or not the email exists (anti-enumeration).',
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email' } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Accepted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/auth/reset-password': {
    post: {
      tags: ['Auth'],
      summary: 'Reset the password with a code',
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'code', 'newPassword'],
              properties: {
                email: { type: 'string', format: 'email' },
                code: { type: 'string', example: '123456' },
                newPassword: { type: 'string', format: 'password' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Password reset.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Rotate the session using the refresh cookie',
      parameters: [CSRF_HEADER],
      responses: {
        200: {
          description: 'Tokens rotated; new cookies set.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        400: {
          description: 'Missing refresh token.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: {
          description: 'Invalid, expired, or revoked refresh token.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        503: {
          description: 'Revocation/credential check temporarily unavailable.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
  },
  '/api/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Sign out (revokes tokens, clears cookies)',
      parameters: [CSRF_HEADER],
      responses: {
        200: {
          description: 'Signed out.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
      },
    },
  },
};
