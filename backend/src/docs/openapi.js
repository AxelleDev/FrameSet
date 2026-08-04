/**
 * OpenAPI 3.0 spec for the FrameSet API; plain object (no build step), served at /api-docs.
 * Paths are written from the server root: feature routers under /api, health probe at /health.
 */

// Path docs live in one module per tag (see ./paths) so each API area stays
// independently reviewable; the openapiSync test still validates the
// assembled whole against the actually mounted routes.
const healthPaths = require('./paths/health');
const authPaths = require('./paths/auth');
const usersPaths = require('./paths/users');
const projectsPaths = require('./paths/projects');
const fontsPaths = require('./paths/fonts');

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
      'and sensitive endpoints are rate limited.\n\n' +
      '**Versioning**: every `/api/*` path documented here is also mounted, identically, ' +
      'under `/api/v1/*` — pin the versioned prefix for external integrations; a breaking ' +
      'change would ship as `/api/v2` while `/api/v1` keeps serving existing clients.',
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
          isDemo: {
            type: 'boolean',
            example: false,
            description: 'True for the shared read-only demo account (see POST /auth/demo-login).',
          },
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
          isDemo: { type: 'boolean', example: false },
          totpEnabled: {
            type: 'boolean',
            example: false,
            description: 'Whether two-factor authentication is turned on for this account.',
          },
          recoveryCodesRemaining: {
            type: 'integer',
            example: 8,
            description:
              'How many single-use 2FA recovery codes are still unused (always 0 when two-factor authentication is off).',
          },
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
          name: { type: 'string', nullable: true, example: 'Hair highlight' },
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
          lastEdited: { type: 'string', example: '2026-06-30T15:16:00.000Z' },
          shareToken: {
            type: 'string',
            nullable: true,
            description:
              'Set when public sharing is enabled; the public page lives at /s/<shareToken>.',
          },
          pinned: {
            type: 'boolean',
            description: 'Pinned projects always sort before unpinned ones on the dashboard.',
          },
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
          shareToken: { type: 'string', nullable: true, example: null },
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
    ...healthPaths,
    ...authPaths,
    ...usersPaths,
    ...projectsPaths,
    ...fontsPaths,
  },
};

module.exports = openapiSpec;
