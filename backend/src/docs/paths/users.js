// Path docs — account profile, email/password management, 2FA settings.
const { AUTH, CSRF_HEADER } = require('../shared');

module.exports = {
  '/api/users/count': {
    get: {
      tags: ['Users'],
      summary: 'Public count of registered users',
      responses: {
        200: {
          description: 'User count.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { count: { type: 'integer', example: 42 } } },
            },
          },
        },
      },
    },
  },
  '/api/users/profile': {
    get: {
      tags: ['Users'],
      summary: "Get the authenticated user's profile",
      security: AUTH,
      responses: {
        200: {
          description: 'Profile.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Profile' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/users': {
    put: {
      tags: ['Users'],
      summary: 'Update name / email (email change staged as pendingEmail)',
      description:
        'Changing the email is a critical action and requires re-authentication: ' +
        '`currentPassword` for accounts with a password, or a fresh Google ID token ' +
        '(`googleCredential`) for Google-only accounts. A name-only change needs neither.',
      security: AUTH,
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                currentPassword: { type: 'string', format: 'password' },
                googleCredential: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Updated.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  pendingEmail: { type: 'string', format: 'email', nullable: true },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/users/password': {
    post: {
      tags: ['Users'],
      summary: 'Change password (re-issues the session)',
      security: AUTH,
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currentPassword', 'newPassword'],
              properties: {
                currentPassword: { type: 'string', format: 'password' },
                newPassword: { type: 'string', format: 'password' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Password changed.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  passwordUpdatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/users/email/verify': {
    post: {
      tags: ['Users'],
      summary: 'Confirm a pending email change',
      security: AUTH,
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
                code: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Email confirmed.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  user: { $ref: '#/components/schemas/Profile' },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/users/email/resend': {
    post: {
      tags: ['Users'],
      summary: 'Resend the pending-email confirmation code',
      security: AUTH,
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
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/users/me': {
    delete: {
      tags: ['Users'],
      summary: 'Delete the account (cascades to its projects)',
      description:
        'Destructive and irreversible, so it requires re-authentication: `currentPassword` ' +
        'for accounts with a password, or a fresh Google ID token (`googleCredential`) for ' +
        'Google-only accounts.',
      security: AUTH,
      parameters: [CSRF_HEADER],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currentPassword: { type: 'string', format: 'password' },
                googleCredential: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Account deleted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/users/totp/setup': {
    post: {
      tags: ['Users'],
      summary: 'Start two-factor authentication enrollment',
      description:
        'Generates a new TOTP secret (not yet active) and returns it plus an `otpauth://` ' +
        'URL to render as a QR code. Call /api/users/totp/confirm with a live code from the ' +
        'authenticator app to finish enrollment. Throws 400 if 2FA is already enabled.',
      security: AUTH,
      parameters: [CSRF_HEADER],
      responses: {
        200: {
          description: 'Pending secret generated.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  secret: { type: 'string', description: 'Base32-encoded shared secret.' },
                  otpauthUrl: { type: 'string' },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/users/totp/confirm': {
    post: {
      tags: ['Users'],
      summary: 'Confirm two-factor enrollment',
      description:
        'Verifies one live code against the pending secret from /api/users/totp/setup; on ' +
        'success 2FA is turned on and a set of single-use recovery codes is returned — this ' +
        'is the only time they are ever shown.',
      security: AUTH,
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code'],
              properties: { code: { type: 'string', example: '123456' } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Two-factor authentication enabled.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  recoveryCodes: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/users/totp/disable': {
    post: {
      tags: ['Users'],
      summary: 'Disable two-factor authentication',
      description:
        'A critical action, so it requires re-authentication: `currentPassword` for accounts ' +
        'with a password, or a fresh Google ID token (`googleCredential`) for Google-only ' +
        'accounts. Clears the secret and every recovery code.',
      security: AUTH,
      parameters: [CSRF_HEADER],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currentPassword: { type: 'string', format: 'password' },
                googleCredential: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Two-factor authentication disabled.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/users/totp/recovery-codes': {
    post: {
      tags: ['Users'],
      summary: 'Regenerate the two-factor recovery codes',
      description:
        'Mints a fresh set of single-use recovery codes and invalidates every previous one — ' +
        'the enrolled authenticator is untouched. A critical action, so it requires ' +
        're-authentication: `currentPassword` for accounts with a password, or a fresh Google ' +
        'ID token (`googleCredential`) for Google-only accounts. The new codes are returned ' +
        'once and never retrievable again.',
      security: AUTH,
      parameters: [CSRF_HEADER],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currentPassword: { type: 'string', format: 'password' },
                googleCredential: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'The fresh single-use recovery codes, shown once.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  recoveryCodes: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['1F2A3-B4C5D-6E7F8-9A0B1'],
                  },
                },
              },
            },
          },
        },
        400: { description: 'Two-factor authentication is not enabled.' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
};
