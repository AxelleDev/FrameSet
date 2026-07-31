// Path docs — Google Fonts catalog proxy.
const { AUTH } = require('../shared');

module.exports = {
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
  '/api/fonts/files': {
    get: {
      tags: ['Fonts'],
      summary: "One family's font-file download URLs (for the PDF export's specimens)",
      security: AUTH,
      parameters: [
        {
          name: 'family',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description: 'Exact Google Fonts family name, e.g. "Parisienne".',
        },
      ],
      responses: {
        200: {
          description: 'Variant name to TTF download URL, as Google exposes them.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  files: {
                    type: 'object',
                    additionalProperties: { type: 'string', format: 'uri' },
                    example: { regular: 'https://fonts.gstatic.com/s/parisienne/….ttf' },
                  },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { description: 'Unknown font family (or no catalog key configured).' },
        502: { description: 'The upstream Google Fonts API could not be reached.' },
      },
    },
  },
};
