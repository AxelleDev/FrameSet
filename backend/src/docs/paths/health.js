// Path docs — health probe.

module.exports = {
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
};
