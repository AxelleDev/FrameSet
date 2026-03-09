const data = require('../../src/data');

describe('data.js', () => {
  const data = require('../../src/data');
  it('should export user object', () => {
    expect(data.user).toBeDefined();
    expect(data.user).toHaveProperty('name');
  });
  it('should export projects array', () => {
    expect(data.projects).toBeInstanceOf(Array);
  });
});
