const data = require('../../src/data');

describe('données', () => {
  const data = require('../../src/data');
  it('devrait exporter l’objet utilisateur', () => {
    expect(data.user).toBeDefined();
    expect(data.user).toHaveProperty('name');
  });
  it('devrait exporter le tableau de projets', () => {
    expect(data.projects).toBeInstanceOf(Array);
  });
});
