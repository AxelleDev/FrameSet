const projectsController = require('../../src/controllers/projects.controller');
const db = require('../../src/database');

jest.mock('../../src/database');

describe('projects controller', () => {
  const projectsController = require('../../src/controllers/projects.controller');
  const db = require('../../src/database');
  jest.mock('../../src/database');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('list projects', () => {
    it('returns 401 when the user is not authenticated', async () => {
      const req = { query: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.listProjects(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not authenticated.' });
    });

    it('returns the projects for the user', async () => {
      db.query.mockResolvedValueOnce([[{ total: 1 }]]); // COUNT(*) for pagination
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
            name: 'Outline',
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
            font_usage: 'Heading',
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
        expect.stringContaining('SELECT COUNT(*) AS total FROM projects WHERE user_id = ?'),
        [1]
      );

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM projects WHERE user_id = ?'),
        [1, 12, 0] // userId, pageSize (default), offset
      );

      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('FROM project_brush_norms WHERE project_id IN'),
        [1]
      );

      expect(db.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('FROM project_typography_norms WHERE project_id IN'),
        [1]
      );

      expect(db.query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('FROM project_palette WHERE project_id IN'),
        [1]
      );

      expect(db.query).toHaveBeenCalledTimes(5);

      expect(res.json).toHaveBeenCalledWith({
        projects: [
          {
            id: 1,
            name: 'Project1',
            lastEdited: '15/03 10:00',
            brushNorms: [
              {
                id: 10,
                name: 'Outline',
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
                fontUsage: 'Heading',
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
        ],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 }
      });
    });

    it('uses 5 SQL queries with 10 projects (1 count + 4 batched, not N+1)', async () => {
      const projectsRows = Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        name: `Project ${index + 1}`,
        lastEditedFormatted: '15/03 10:00'
      }));

      db.query
        .mockResolvedValueOnce([[{ total: 10 }]]) // COUNT(*) for pagination
        .mockResolvedValueOnce([projectsRows])
        .mockResolvedValueOnce([
          [
            { id: 1, project_id: 1, name: 'Outline', value: '4', unit: 'px', brush_name: 'Soft' },
            { id: 2, project_id: 2, name: 'Shadow', value: '6', unit: 'px', brush_name: 'Hard' }
          ]
        ])
        .mockResolvedValueOnce([
          [
            { id: 3, project_id: 1, font_family: 'Inter', font_weight: '700', font_usage: 'Heading', font_style: 'Normal' }
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

      expect(db.query).toHaveBeenCalledTimes(5);
      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('FROM project_brush_norms WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
      expect(db.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('FROM project_typography_norms WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
      expect(db.query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('FROM project_palette WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ projects: expect.any(Array) })
      );
    });
  });

  describe('add standards', () => {
    it('returns 400 when the brush size is invalid', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { name: 'Outline', value: 'abc', unit: 'px', brushName: 'Smooth' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.addBrushNorm(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'The brush size must be a positive number.' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when the typography family is invalid', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { fontFamily: '   ', fontWeight: '700', fontUsage: 'Heading', fontStyle: 'Italic' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.addTypographyNorm(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'The font family is invalid.' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('adds a valid brush standard', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ensureProjectOwnership
        .mockResolvedValueOnce([{ insertId: 9 }])
        .mockResolvedValueOnce([{}]);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { name: '  Hair outline  ', value: ' 8 ', unit: ' px ', brushName: ' Smooth ' }
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.addBrushNorm(req, res);

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO project_brush_norms'),
        ['1', 'Hair outline', '8', 'px', 'Smooth', null]
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, id: 9 });
    });
  });

  describe('palette update', () => {
    it('returns 400 when the body is not an array', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership passes
      const req = { params: { id: '1' }, user: { id: 1 }, body: { not: 'an array' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePalette(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      // Ownership is checked first (1 query); the palette is never written.
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when a color has an invalid hex', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership passes
      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: [{ name: 'X', hex: 'not-a-hex' }]
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePalette(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('replaces the palette while persisting the order and removing missing colors', async () => {
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

    it('deletes everything then reinserts when no existing color is kept', async () => {
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
