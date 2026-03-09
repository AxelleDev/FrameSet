const database = require('../../src/database');

describe('base de données', () => {
  it('devrait exporter un pool de promesses', () => {
    const pool = require('../../src/database');
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });
});
