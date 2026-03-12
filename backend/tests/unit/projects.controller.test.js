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

  describe('ajouter des normes', () => {
    it('devrait retourner 400 si la valeur de norme de trait est invalide', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { name: 'Contour', value: 'abc', unit: 'px', brushName: 'Smooth' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.addBrushNorm(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'La valeur de la norme de trait doit etre un nombre positif.' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('devrait retourner 400 si la famille typographique est invalide', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { fontFamily: '   ', fontWeight: '700', fontUsage: 'Titre', fontStyle: 'Italic' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.addTypographyNorm(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'La famille de police est invalide.' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('devrait ajouter une norme de trait valide', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ensureProjectOwnership
        .mockResolvedValueOnce([{ insertId: 9 }])
        .mockResolvedValueOnce([{}]);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { name: '  Contour cheveux  ', value: ' 8 ', unit: ' px ', brushName: ' Smooth ' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.addBrushNorm(req, res);

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO project_brush_norms'),
        ['1', 'Contour cheveux', '8', 'px', 'Smooth']
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, id: 9 });
    });
  });
});
