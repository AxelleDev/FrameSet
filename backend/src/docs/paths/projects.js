// Path docs — projects, their standards, palette, trash and sharing.
const { AUTH, CSRF_HEADER } = require('../shared');

module.exports = {
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
        {
          name: 'search',
          in: 'query',
          description: 'Case-insensitive substring match on the project name.',
          schema: { type: 'string' },
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
  '/api/projects/{id}/duplicate': {
    post: {
      tags: ['Projects'],
      summary: 'Duplicate a project (norms + palette) as "<name> (copy)"',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        201: {
          description: 'The duplicated project, with its copied norms and palette.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/projects/{id}': {
    get: {
      tags: ['Projects'],
      summary: 'Fetch a single project (same shape as a list item)',
      description:
        'The paginated list stays the primary source; this endpoint lets a deep link or ' +
        'hard reload resolve a project that sits beyond the loaded pages. A trashed, ' +
        "unknown or someone else's project is a plain 404.",
      security: AUTH,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: {
          description: 'The project, with its norms and palette.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
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
      summary: 'Move a project to the trash (restorable for 30 days)',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Moved to the trash.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/projects/search': {
    get: {
      tags: ['Projects'],
      summary: "Search the user's projects, palette colors and standards",
      description:
        'One term (1-100 characters) matched against project names, color usage/hex ' +
        "('#' optional) and brush/typography standards, capped at 5 matches per " +
        'category. Only the authenticated user’s live (non-trashed) content is searched.',
      security: AUTH,
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          schema: { type: 'string', minLength: 1, maxLength: 100 },
        },
      ],
      responses: {
        200: {
          description: 'Grouped matches.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projects: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { id: { type: 'integer' }, name: { type: 'string' } },
                    },
                  },
                  colors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string', nullable: true },
                        hex: { type: 'string' },
                        projectId: { type: 'integer' },
                        projectName: { type: 'string' },
                      },
                    },
                  },
                  brushNorms: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        brushName: { type: 'string', nullable: true },
                        projectId: { type: 'integer' },
                        projectName: { type: 'string' },
                      },
                    },
                  },
                  typographyNorms: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        fontFamily: { type: 'string' },
                        fontUsage: { type: 'string', nullable: true },
                        projectId: { type: 'integer' },
                        projectName: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/projects/trash': {
    get: {
      tags: ['Projects'],
      summary: "List the user's trashed projects (with days left before purge)",
      security: AUTH,
      responses: {
        200: {
          description: 'Trashed projects.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projects: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        deletedAt: { type: 'string', format: 'date-time' },
                        daysLeft: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/projects/{id}/restore': {
    post: {
      tags: ['Projects'],
      summary: 'Restore a trashed project to the dashboard',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Restored.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/projects/{id}/permanent': {
    delete: {
      tags: ['Projects'],
      summary: 'Permanently delete a TRASHED project (irreversible)',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Permanently deleted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/projects/pinned/reorder': {
    post: {
      tags: ['Projects'],
      summary: "Reorder the user's pinned projects (drag-and-drop)",
      security: AUTH,
      parameters: [CSRF_HEADER],
      requestBody: {
        required: true,
        description: 'Ordered array of pinned project ids.',
        content: {
          'application/json': {
            schema: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
      responses: {
        200: {
          description: 'Reordered.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/projects/{id}/pin': {
    post: {
      tags: ['Projects'],
      summary: 'Pin a project to the top of the dashboard (idempotent)',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Pinned.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Projects'],
      summary: 'Unpin a project',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Unpinned.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/projects/{id}/share': {
    post: {
      tags: ['Projects'],
      summary: 'Enable public sharing (mints or returns the stable share token)',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Sharing enabled; the public page lives at /s/<shareToken>.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { shareToken: { type: 'string' } } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
    delete: {
      tags: ['Projects'],
      summary: 'Disable public sharing (the link dies immediately)',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Sharing disabled.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/share/{token}': {
    get: {
      tags: ['Projects'],
      summary: 'PUBLIC: read a shared reference sheet (no auth)',
      description:
        'Resolves a share token to the project name, brush/typography norms and palette. ' +
        'Also includes the owner\'s display name (a "Made by" credit) — never their id, ' +
        'email or the project id. Rate limited per IP; revoked/trashed links answer 404.',
      parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'The shared reference sheet.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  ownerName: { type: 'string' },
                  brushNorms: { type: 'array', items: { type: 'object' } },
                  typographyNorms: { type: 'array', items: { type: 'object' } },
                  palette: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/share/{token}/preview.png': {
    get: {
      tags: ['Projects'],
      summary: 'PUBLIC: social-preview image for a share link (no auth)',
      description:
        'A 1200x630 PNG of the shared project — its name, owner credit and actual palette ' +
        'swatches — rendered server-side. Used as the og:image behind share links so they ' +
        'unfurl with a real preview on social platforms. Same 404 contract as the share read.',
      parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'The preview image.',
          content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
        },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    },
  },
  '/api/share/{token}/embed': {
    get: {
      tags: ['Projects'],
      summary: 'PUBLIC: crawler-facing HTML for a share link (no auth)',
      description:
        'A minimal HTML document carrying the Open Graph / Twitter Card tags (including the ' +
        'preview image) for a shared project. Social scrapers do not execute the SPA, so the ' +
        'frontend rewrites their requests for /s/:token here; humans landing on it are ' +
        'redirected to the real page.',
      parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'The embed HTML.',
          content: { 'text/html': { schema: { type: 'string' } } },
        },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimited' },
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
  '/api/projects/{id}/brush-norms/reorder': {
    post: {
      tags: ['Projects'],
      summary: 'Reorder brush standards (drag-and-drop)',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      requestBody: {
        required: true,
        description: "Ordered array of the project's brush-standard ids.",
        content: {
          'application/json': {
            schema: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
      responses: {
        200: {
          description: 'Reordered.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
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
  '/api/projects/{projectId}/brush-norms/trash': {
    get: {
      tags: ['Projects'],
      summary: "List a project's trashed brush standards (with days left before purge)",
      security: AUTH,
      parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Trashed brush standards.' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/projects/{projectId}/brush-norms/{normId}/restore': {
    post: {
      tags: ['Projects'],
      summary: 'Restore a trashed brush standard',
      security: AUTH,
      parameters: [
        { name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'normId', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Restored.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/projects/{projectId}/brush-norms/{normId}/permanent': {
    delete: {
      tags: ['Projects'],
      summary: 'Permanently delete a TRASHED brush standard (irreversible)',
      security: AUTH,
      parameters: [
        { name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'normId', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Permanently deleted.',
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
  '/api/projects/{id}/typography-norms/reorder': {
    post: {
      tags: ['Projects'],
      summary: 'Reorder typography standards (drag-and-drop)',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      requestBody: {
        required: true,
        description: "Ordered array of the project's typography-standard ids.",
        content: {
          'application/json': {
            schema: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
      responses: {
        200: {
          description: 'Reordered.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
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
  '/api/projects/{projectId}/typography-norms/trash': {
    get: {
      tags: ['Projects'],
      summary: "List a project's trashed typography standards (with days left before purge)",
      security: AUTH,
      parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Trashed typography standards.' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/projects/{projectId}/typography-norms/{normId}/restore': {
    post: {
      tags: ['Projects'],
      summary: 'Restore a trashed typography standard',
      security: AUTH,
      parameters: [
        { name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'normId', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Restored.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/projects/{projectId}/typography-norms/{normId}/permanent': {
    delete: {
      tags: ['Projects'],
      summary: 'Permanently delete a TRASHED typography standard (irreversible)',
      security: AUTH,
      parameters: [
        { name: 'projectId', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'normId', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Permanently deleted.',
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
  '/api/projects/{id}/palette/trash': {
    get: {
      tags: ['Projects'],
      summary: "List a project's trashed colors (with days left before purge)",
      security: AUTH,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'Trashed colors.' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/api/projects/{id}/palette/{colorId}': {
    delete: {
      tags: ['Projects'],
      summary: 'Move a single color to the trash (soft delete)',
      description:
        'Distinct from POST .../palette (bulk replace): this is the single-color delete used ' +
        'by the palette editor, so a deletion is always independently restorable.',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'colorId', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Moved to the trash.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/projects/{id}/palette/{colorId}/restore': {
    post: {
      tags: ['Projects'],
      summary: 'Restore a trashed color',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'colorId', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Restored.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/projects/{id}/palette/{colorId}/permanent': {
    delete: {
      tags: ['Projects'],
      summary: 'Permanently delete a TRASHED color (irreversible)',
      security: AUTH,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'colorId', in: 'path', required: true, schema: { type: 'integer' } },
        CSRF_HEADER,
      ],
      responses: {
        200: {
          description: 'Permanently deleted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
};
