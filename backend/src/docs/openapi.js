/**
 * OpenAPI 3.0 spec for the FrameSet API; plain object (no build step), served at /api-docs.
 * Paths are written from the server root: feature routers under /api, health probe at /health.
 */

// Reusable security requirement for authenticated endpoints (cookie OR bearer).
const AUTH = [{ cookieAuth: [] }, { bearerAuth: [] }];
// Reusable CSRF header for mutating requests (double-submit cookie pattern).
const CSRF_HEADER = { $ref: '#/components/parameters/CsrfToken' };

const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FrameSet API',
    version: '1.0.0',
    description:
      "REST API for FrameSet — a workspace where illustrators define a project's " +
      'visual identity (brush + typography standards and color palettes).\n\n' +
      '**Authentication** is carried by HttpOnly cookies set on login ' +
      '(`frameset_access_token` short-lived 2h, `frameset_refresh_token` 7d, ' +
      'rotated on refresh); a `Bearer` token is also accepted. **Mutating requests** ' +
      '(`POST`/`PUT`/`PATCH`/`DELETE`) use the double-submit CSRF pattern: send the ' +
      '`frameset_csrf_token` cookie value back in the `x-csrf-token` header ' +
      '(fetch one via `GET /api/auth/csrf-token`). The JSON body is capped at 10 kB ' +
      'and sensitive endpoints are rate limited.',
    contact: { name: 'Axelle Tempier', email: 'axelle.tempier@gmail.com' },
  },
  servers: [{ url: '/', description: 'Same origin as the app' }],
  tags: [
    { name: 'Health', description: 'Liveness / readiness probe' },
    { name: 'Auth', description: 'Registration, sessions, password reset, CSRF' },
    { name: 'Users', description: 'Account profile, email and password management' },
    { name: 'Projects', description: 'Projects and their brush/typography standards and palette' },
    { name: 'Fonts', description: 'Google Fonts catalog proxy (keeps the API key server-side)' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'frameset_access_token',
        description: 'HttpOnly access-token cookie set on login.',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Alternatively, pass the access token as a Bearer token.',
      },
    },
    parameters: {
      CsrfToken: {
        name: 'x-csrf-token',
        in: 'header',
        required: true,
        schema: { type: 'string' },
        description: 'Value of the `frameset_csrf_token` cookie (double-submit CSRF).',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed.' },
          message: { type: 'string', description: 'Present on 5xx (generic) errors.' },
        },
        required: ['error'],
      },
      Success: {
        type: 'object',
        properties: { success: { type: 'boolean', example: true } },
        required: ['success'],
      },
      User: {
        type: 'object',
        description: 'Authenticated user payload returned by register/login (alongside `success`).',
        properties: {
          success: { type: 'boolean', example: true },
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Axelle' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          avatarInitials: { type: 'string', example: 'AX' },
          isVerified: { type: 'boolean', example: true },
          passwordUpdatedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Profile: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Axelle' },
          email: { type: 'string', format: 'email' },
          avatarInitials: { type: 'string', example: 'AX' },
          passwordUpdatedAt: { type: 'string', format: 'date-time', nullable: true },
          pendingEmail: { type: 'string', format: 'email', nullable: true },
        },
      },
      BrushNorm: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 10, readOnly: true },
          name: { type: 'string', example: 'Outline' },
          value: { type: 'string', example: '8', description: 'Positive number (≤ 1000).' },
          unit: { type: 'string', example: 'px', description: 'Letters or % only.' },
          brushName: { type: 'string', nullable: true, example: 'Smooth' },
          opacity: {
            type: 'number',
            format: 'float',
            nullable: true,
            minimum: 0,
            maximum: 1,
            example: 1,
          },
        },
      },
      TypographyNorm: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 11, readOnly: true },
          fontFamily: { type: 'string', example: 'Inter' },
          fontWeight: { type: 'string', nullable: true, example: '700' },
          fontUsage: { type: 'string', nullable: true, example: 'Heading' },
          fontStyle: { type: 'string', nullable: true, example: 'Italic' },
        },
      },
      PaletteColor: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 5 },
          name: { type: 'string', nullable: true, example: 'Primary' },
          hex: {
            type: 'string',
            pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$',
            example: '#112233',
          },
        },
        required: ['hex'],
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Neo-Tokyo Editorial' },
          lastEdited: { type: 'string', example: '30/06 15:16' },
          brushNorms: { type: 'array', items: { $ref: '#/components/schemas/BrushNorm' } },
          typographyNorms: {
            type: 'array',
            items: { $ref: '#/components/schemas/TypographyNorm' },
          },
          normsCount: { type: 'integer', example: 2 },
          palette: { type: 'array', items: { $ref: '#/components/schemas/PaletteColor' } },
        },
      },
      CreatedProject: {
        type: 'object',
        description: 'Shape returned right after creation: a fresh, empty project.',
        properties: {
          id: { type: 'integer', example: 7 },
          name: { type: 'string', example: 'Neo-Tokyo Editorial' },
          lastEdited: { type: 'string', example: 'Just now' },
          normsCount: { type: 'integer', example: 0 },
          norms: { type: 'array', items: {}, example: [] },
          palette: {
            type: 'array',
            items: { $ref: '#/components/schemas/PaletteColor' },
            example: [],
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 12 },
          total: { type: 'integer', example: 27 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
      ProjectsPage: {
        type: 'object',
        properties: {
          projects: { type: 'array', items: { $ref: '#/components/schemas/Project' } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
    },
    responses: {
      ValidationError: {
        description: 'Invalid request payload.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Unauthorized: {
        description: 'Missing or invalid authentication.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Not the owner, or invalid/missing CSRF token.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description: 'Too many requests (rate limited).',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness + DB ping',
        responses: {
          200: {
            description: 'Service healthy.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    db: { type: 'string', example: 'reachable' },
                    uptime: { type: 'number', example: 1234.56 },
                  },
                },
              },
            },
          },
          503: { description: 'Database unreachable.' },
        },
      },
    },

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
    '/api/auth/google': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with Google (sets auth cookies)',
        description:
          'Verifies a Google ID token (from Google Identity Services) and signs the user in, ' +
          'creating or linking the account as needed. Returns 503 when Google sign-in is not configured.',
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

    '/api/projects': {
      get: {
        tags: ['Projects'],
        summary: "List the user's projects (paginated, newest first)",
        security: AUTH,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 12 },
          },
        ],
        responses: {
          200: {
            description: 'A page of projects.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProjectsPage' } },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Projects'],
        summary: 'Create a project',
        security: AUTH,
        parameters: [CSRF_HEADER],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: {
                    type: 'string',
                    minLength: 2,
                    maxLength: 50,
                    example: 'Neo-Tokyo Editorial',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created project (fresh and empty).',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CreatedProject' } },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/projects/{id}': {
      patch: {
        tags: ['Projects'],
        summary: 'Rename a project',
        security: AUTH,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', minLength: 2, maxLength: 50 } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Renamed.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean' }, name: { type: 'string' } },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete a project',
        security: AUTH,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        responses: {
          200: {
            description: 'Deleted.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/projects/{id}/brush-norms': {
      post: {
        tags: ['Projects'],
        summary: 'Add a brush standard',
        security: AUTH,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'value'],
                properties: {
                  name: { type: 'string' },
                  value: { type: 'string', description: 'Positive number ≤ 1000.' },
                  unit: { type: 'string', description: 'Letters or % only.' },
                  brushName: { type: 'string' },
                  opacity: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean' }, id: { type: 'integer' } },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/projects/{projectId}/brush-norms/{normId}': {
      put: {
        tags: ['Projects'],
        summary: 'Update a brush standard',
        security: AUTH,
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'normId', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BrushNorm' } } },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete a brush standard',
        security: AUTH,
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'normId', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        responses: {
          200: {
            description: 'Deleted.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/projects/{id}/typography-norms': {
      post: {
        tags: ['Projects'],
        summary: 'Add a typography standard',
        security: AUTH,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fontFamily'],
                properties: {
                  fontFamily: { type: 'string' },
                  fontWeight: { type: 'string' },
                  fontUsage: { type: 'string' },
                  fontStyle: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean' }, id: { type: 'integer' } },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/projects/{projectId}/typography-norms/{normId}': {
      put: {
        tags: ['Projects'],
        summary: 'Update a typography standard',
        security: AUTH,
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'normId', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TypographyNorm' } },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete a typography standard',
        security: AUTH,
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'normId', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        responses: {
          200: {
            description: 'Deleted.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/projects/{id}/palette': {
      post: {
        tags: ['Projects'],
        summary: 'Replace the whole palette (atomic, order preserved)',
        security: AUTH,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          CSRF_HEADER,
        ],
        requestBody: {
          required: true,
          description:
            'Ordered array of up to 50 colors. Existing colors keep their id; new ones omit it.',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                maxItems: 50,
                items: { $ref: '#/components/schemas/PaletteColor' },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Palette replaced; returns the canonical palette.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    palette: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PaletteColor' },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/fonts': {
      get: {
        tags: ['Fonts'],
        summary: 'Google Fonts catalog (proxied server-side, key never exposed)',
        security: AUTH,
        responses: {
          200: {
            description: 'Available font families and their variants.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          family: { type: 'string', example: 'Roboto' },
                          variants: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['regular', '700'],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          502: { description: 'The upstream Google Fonts API could not be reached.' },
        },
      },
    },
  },
};

module.exports = openapiSpec;
