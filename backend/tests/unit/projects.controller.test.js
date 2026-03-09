const projectsController = require('../../src/controllers/projects.controller');
const db = require('../../src/database');

jest.mock('../../src/database');

describe('contrôleur de projets', () => {
  const projectsController = require('../../src/controllers/projects.controller');
  const db = require('../../src/database');
  jest.mock('../../src/database');

  describe('lister les projets', () => {
    it('devrait retourner un tableau vide si aucun userId', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };
      await projectsController.listProjects(req, res);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('devrait retourner les projets pour l’utilisateur', async () => {
      db.query.mockResolvedValueOnce([
        [
          { id: 1, name: 'Project1', last_edited: new Date(), user_id: 1 }
        ]
      ]);
      db.query.mockResolvedValueOnce([[]]); // brushNorms
      db.query.mockResolvedValueOnce([[]]); // typographyNorms
      db.query.mockResolvedValueOnce([[]]); // palette
      const req = { query: { userId: 1 } };
      const res = { json: jest.fn() };
      await projectsController.listProjects(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });
});
