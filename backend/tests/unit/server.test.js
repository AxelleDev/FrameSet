jest.mock('../../src/app', () => ({
  listen: jest.fn((port, cb) => cb && cb())
}));

describe('serveur', () => {
  it('devrait démarrer le serveur', () => {
    require('../../src/server');
    const app = require('../../src/app');
    expect(app.listen).toHaveBeenCalled();
  });
});
