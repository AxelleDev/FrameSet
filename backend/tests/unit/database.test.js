const database = require('../../src/database');

describe('database', () => {
  it('exports a promise pool', () => {
    const pool = require('../../src/database');
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });
});
