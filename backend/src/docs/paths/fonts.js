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
};
