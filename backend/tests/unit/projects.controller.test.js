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

  describe('operations palette', () => {
    it('devrait retourner 400 si la couleur a supprimer est invalide', async () => {
      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { hex: 'not-a-hex' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.deletePaletteColor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Couleur invalide : la valeur hex "not-a-hex" n\'est pas un format valide (#RGB ou #RRGGBB).'
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devrait supprimer une couleur valide', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ensureProjectOwnership
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{}]);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { hex: '  #AABBCC  ' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.deletePaletteColor(req, res);

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM project_palette WHERE project_id = ? AND hex = ?',
        ['1', '#AABBCC']
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait retourner 400 si la couleur source est invalide lors de la modification', async () => {
      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { oldHex: 'bad', newHex: '#123456', newName: 'Accent' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePaletteColor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Couleur invalide : la valeur hex "bad" n\'est pas un format valide (#RGB ou #RRGGBB).'
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devrait retourner 400 si le nom de couleur est invalide lors de la modification', async () => {
      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { oldHex: '#AABBCC', newHex: '#123456', newName: '   ' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePaletteColor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Le nom de la couleur est invalide.' });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devrait modifier une couleur valide', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ensureProjectOwnership
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{}]);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: {
          oldHex: ' #AABBCC ',
          newHex: ' #123456 ',
          newName: '  Accent principal  '
        }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePaletteColor(req, res);

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        'UPDATE project_palette SET name = ?, hex = ? WHERE project_id = ? AND hex = ?',
        ['Accent principal', '#123456', '1', '#AABBCC']
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait retourner 404 si la couleur a modifier est introuvable', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ensureProjectOwnership
        .mockResolvedValueOnce([{ affectedRows: 0 }]);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: {
          oldHex: '#AABBCC',
          newHex: '#123456',
          newName: 'Accent'
        }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePaletteColor(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Couleur non trouvée' });
      expect(db.query).toHaveBeenCalledTimes(2);
    });
  });
});
