const database = require('../../src/database');

describe('database.js', () => {
  it('should export a promise pool', () => {
    const pool = require('../../src/database');
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });
});
