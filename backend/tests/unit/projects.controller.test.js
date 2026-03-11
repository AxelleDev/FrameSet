const projectsController = require('../../src/controllers/projects.controller');
const db = require('../../src/database');

jest.mock('../../src/database');

describe('contrôleur de projets', () => {
  const projectsController = require('../../src/controllers/projects.controller');
  const db = require('../../src/database');
  jest.mock('../../src/database');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('lister les projets', () => {
    it('devrait retourner 401 si utilisateur non authentifié', async () => {
      const req = { query: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.listProjects(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Utilisateur non authentifié.' });
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
      const req = { query: { userId: 999 }, user: { id: 1 } };
      const res = { json: jest.fn() };
      await projectsController.listProjects(req, res);
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FROM projects WHERE user_id = ?'),
        [1]
      );
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });
});
