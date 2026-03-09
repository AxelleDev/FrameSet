jest.mock('../../src/app', () => ({
  listen: jest.fn((port, cb) => cb && cb())
}));

describe('server.js', () => {
  it('should start server', () => {
    require('../../src/server');
    const app = require('../../src/app');
    expect(app.listen).toHaveBeenCalled();
  });
});
