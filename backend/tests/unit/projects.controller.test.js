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
          { id: 1, name: 'Project1', lastEditedFormatted: '15/03 10:00' }
        ]
      ]);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 10,
            project_id: 1,
            name: 'Contour',
            value: '8',
            unit: 'px',
            brush_name: 'Smooth'
          }
        ]
      ]);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 11,
            project_id: 1,
            font_family: 'Inter',
            font_weight: '700',
            font_usage: 'Titre',
            font_style: 'Italic'
          }
        ]
      ]);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 5,
            project_id: 1,
            name: 'Primary',
            hex: '#112233'
          }
        ]
      ]);

      const req = { query: { userId: 999 }, user: { id: 1 } };
      const res = { json: jest.fn() };

      await projectsController.listProjects(req, res);

      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FROM projects WHERE user_id = ?'),
        [1]
      );

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM project_brush_norms WHERE project_id IN'),
        [1]
      );

      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('FROM project_typography_norms WHERE project_id IN'),
        [1]
      );

      expect(db.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('FROM project_palette WHERE project_id IN'),
        [1]
      );

      expect(db.query).toHaveBeenCalledTimes(4);

      expect(res.json).toHaveBeenCalledWith([
        {
          id: 1,
          name: 'Project1',
          lastEdited: '15/03 10:00',
          brushNorms: [
            {
              id: 10,
              name: 'Contour',
              value: '8',
              unit: 'px',
              brushName: 'Smooth'
            }
          ],
          typographyNorms: [
            {
              id: 11,
              fontFamily: 'Inter',
              fontWeight: '700',
              fontUsage: 'Titre',
              fontStyle: 'Italic'
            }
          ],
          normsCount: 2,
          palette: [
            {
              id: 5,
              name: 'Primary',
              hex: '#112233'
            }
          ]
        }
      ]);
    });

    it('devrait utiliser 4 requetes SQL avec 10 projets (au lieu de 31 en N+1)', async () => {
      const projectsRows = Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        name: `Project ${index + 1}`,
        lastEditedFormatted: '15/03 10:00'
      }));

      db.query
        .mockResolvedValueOnce([projectsRows])
        .mockResolvedValueOnce([
          [
            { id: 1, project_id: 1, name: 'Contour', value: '4', unit: 'px', brush_name: 'Soft' },
            { id: 2, project_id: 2, name: 'Ombre', value: '6', unit: 'px', brush_name: 'Hard' }
          ]
        ])
        .mockResolvedValueOnce([
          [
            { id: 3, project_id: 1, font_family: 'Inter', font_weight: '700', font_usage: 'Titre', font_style: 'Normal' }
          ]
        ])
        .mockResolvedValueOnce([
          [
            { id: 7, project_id: 2, name: 'Primary', hex: '#AABBCC' }
          ]
        ]);

      const req = { user: { id: 1 } };
      const res = { json: jest.fn() };

      await projectsController.listProjects(req, res);

      expect(db.query).toHaveBeenCalledTimes(4);
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM project_brush_norms WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('FROM project_typography_norms WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
      expect(db.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('FROM project_palette WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
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
        ['1', 'Contour cheveux', '8', 'px', 'Smooth', null]
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, id: 9 });
    });
  });

  describe('mise a jour de la palette', () => {
    it('devrait retourner 400 si le corps n\'est pas un tableau', async () => {
      const req = { params: { id: '1' }, user: { id: 1 }, body: { not: 'an array' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePalette(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devrait retourner 400 si une couleur a un hex invalide', async () => {
      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: [{ name: 'X', hex: 'not-a-hex' }]
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePalette(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devrait remplacer la palette en persistant l\'ordre et en supprimant les couleurs absentes', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership (pool)

      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        query: jest.fn()
          .mockResolvedValueOnce([[{ id: 10 }, { id: 11 }]]) // SELECT existing ids
          .mockResolvedValueOnce([{}]) // DELETE colors no longer present
          .mockResolvedValueOnce([{}]) // UPDATE existing color (id 10)
          .mockResolvedValueOnce([{}]) // INSERT new color
          .mockResolvedValueOnce([{}]) // UPDATE projects.last_edited
          .mockResolvedValueOnce([[ // SELECT canonical palette
            { id: 10, name: 'Primary', hex: '#112233' },
            { id: 12, name: 'Accent', hex: '#AA0000' }
          ]])
      };
      db.getConnection.mockResolvedValue(connection);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: [
          { id: 10, name: 'Primary', hex: '#112233' },
          { name: 'Accent', hex: '#AA0000' }
        ]
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePalette(req, res);

      // The only kept id is 10, so every other color of the project is removed.
      expect(connection.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE FROM project_palette WHERE project_id = ? AND id NOT IN'),
        ['1', 10]
      );
      // The existing color keeps its id and is written at position 0.
      expect(connection.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE project_palette SET name = ?, hex = ?, position = ?'),
        ['Primary', '#112233', 0, 10, '1']
      );
      // The new color is inserted at position 1.
      expect(connection.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('INSERT INTO project_palette'),
        ['1', 'Accent', '#AA0000', 1]
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        palette: [
          { id: 10, name: 'Primary', hex: '#112233' },
          { id: 12, name: 'Accent', hex: '#AA0000' }
        ]
      });
    });

    it('devrait tout supprimer puis reinserer quand aucune couleur existante n\'est conservee', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership (pool)

      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        query: jest.fn()
          .mockResolvedValueOnce([[]]) // SELECT existing ids (none kept)
          .mockResolvedValueOnce([{}]) // DELETE all
          .mockResolvedValueOnce([{}]) // INSERT new color
          .mockResolvedValueOnce([{}]) // UPDATE projects.last_edited
          .mockResolvedValueOnce([[{ id: 20, name: 'X', hex: '#000000' }]]) // SELECT canonical palette
      };
      db.getConnection.mockResolvedValue(connection);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: [{ name: 'X', hex: '#000000' }]
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePalette(req, res);

      expect(connection.query).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM project_palette WHERE project_id = ?',
        ['1']
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        palette: [{ id: 20, name: 'X', hex: '#000000' }]
      });
    });
  });
});
