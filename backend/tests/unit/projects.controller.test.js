const projectsController = require('../../src/controllers/projects.controller');
const db = require('../../src/database');

jest.mock('../../src/database');

describe('projects controller', () => {
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
        [{ id: 1, name: 'Project1', lastEditedFormatted: '15/03 10:00' }],
      ]);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 10,
            project_id: 1,
            name: 'Outline',
            value: '8',
            unit: 'px',
            brush_name: 'Smooth',
          },
        ],
      ]);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 11,
            project_id: 1,
            font_family: 'Inter',
            font_weight: '700',
            font_usage: 'Heading',
            font_style: 'Italic',
          },
        ],
      ]);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 5,
            project_id: 1,
            name: 'Primary',
            hex: '#112233',
          },
        ],
      ]);

      const req = { query: { userId: 999 }, user: { id: 1 } };
      const res = { json: jest.fn() };

      await projectsController.listProjects(req, res);

      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT COUNT(*) AS total FROM projects WHERE user_id = ?'),
        [1],
      );

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM projects WHERE user_id = ?'),
        [1, 12, 0], // userId, pageSize (default), offset
      );

      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('FROM project_brush_norms WHERE project_id IN'),
        [1],
      );

      expect(db.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('FROM project_typography_norms WHERE project_id IN'),
        [1],
      );

      expect(db.query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('FROM project_palette WHERE project_id IN'),
        [1],
      );

      expect(db.query).toHaveBeenCalledTimes(5);

      expect(res.json).toHaveBeenCalledWith({
        projects: [
          {
            id: 1,
            name: 'Project1',
            lastEdited: '15/03 10:00',
            shareToken: null,
            brushNorms: [
              {
                id: 10,
                name: 'Outline',
                value: '8',
                unit: 'px',
                brushName: 'Smooth',
              },
            ],
            typographyNorms: [
              {
                id: 11,
                fontFamily: 'Inter',
                fontWeight: '700',
                fontUsage: 'Heading',
                fontStyle: 'Italic',
              },
            ],
            normsCount: 2,
            palette: [
              {
                id: 5,
                name: 'Primary',
                hex: '#112233',
              },
            ],
          },
        ],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
    });

    it('uses 5 SQL queries with 10 projects (1 count + 4 batched, not N+1)', async () => {
      const projectsRows = Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        name: `Project ${index + 1}`,
        lastEditedFormatted: '15/03 10:00',
      }));

      db.query
        .mockResolvedValueOnce([[{ total: 10 }]]) // COUNT(*) for pagination
        .mockResolvedValueOnce([projectsRows])
        .mockResolvedValueOnce([
          [
            { id: 1, project_id: 1, name: 'Outline', value: '4', unit: 'px', brush_name: 'Soft' },
            { id: 2, project_id: 2, name: 'Shadow', value: '6', unit: 'px', brush_name: 'Hard' },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              id: 3,
              project_id: 1,
              font_family: 'Inter',
              font_weight: '700',
              font_usage: 'Heading',
              font_style: 'Normal',
            },
          ],
        ])
        .mockResolvedValueOnce([[{ id: 7, project_id: 2, name: 'Primary', hex: '#AABBCC' }]]);

      const req = { user: { id: 1 } };
      const res = { json: jest.fn() };

      await projectsController.listProjects(req, res);

      expect(db.query).toHaveBeenCalledTimes(5);
      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('FROM project_brush_norms WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      );
      expect(db.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('FROM project_typography_norms WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      );
      expect(db.query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('FROM project_palette WHERE project_id IN'),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ projects: expect.any(Array) }),
      );
    });
  });

  describe('add standards', () => {
    it('returns 400 when the brush size is invalid', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: { name: 'Outline', value: 'abc', unit: 'px', brushName: 'Smooth' },
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
        body: { fontFamily: '   ', fontWeight: '700', fontUsage: 'Heading', fontStyle: 'Italic' },
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
        body: { name: '  Hair outline  ', value: ' 8 ', unit: ' px ', brushName: ' Smooth ' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.addBrushNorm(req, res);

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO project_brush_norms'),
        ['1', 'Hair outline', '8', 'px', 'Smooth', null],
      );
      expect(res.status).toHaveBeenCalledWith(201);
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
        body: [{ name: 'X', hex: 'not-a-hex' }],
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
        query: jest
          .fn()
          .mockResolvedValueOnce([[{ id: 10 }, { id: 11 }]]) // SELECT existing ids
          .mockResolvedValueOnce([{}]) // DELETE colors no longer present
          .mockResolvedValueOnce([{}]) // UPDATE existing color (id 10)
          .mockResolvedValueOnce([{}]) // INSERT new color
          .mockResolvedValueOnce([{}]) // UPDATE projects.last_edited
          .mockResolvedValueOnce([
            [
              // SELECT canonical palette
              { id: 10, name: 'Primary', hex: '#112233' },
              { id: 12, name: 'Accent', hex: '#AA0000' },
            ],
          ]),
      };
      db.getConnection.mockResolvedValue(connection);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: [
          { id: 10, name: 'Primary', hex: '#112233' },
          { name: 'Accent', hex: '#AA0000' },
        ],
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePalette(req, res);

      // The only kept id is 10, so every other color of the project is soft-deleted (trashed).
      expect(connection.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          'UPDATE project_palette SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL AND id NOT IN',
        ),
        ['1', 10],
      );
      // The existing color keeps its id and is written at position 0.
      expect(connection.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE project_palette SET name = ?, hex = ?, position = ?'),
        ['Primary', '#112233', 0, 10, '1'],
      );
      // The new color is inserted at position 1.
      expect(connection.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('INSERT INTO project_palette'),
        ['1', 'Accent', '#AA0000', 1],
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        palette: [
          { id: 10, name: 'Primary', hex: '#112233' },
          { id: 12, name: 'Accent', hex: '#AA0000' },
        ],
      });
    });

    it('deletes everything then reinserts when no existing color is kept', async () => {
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // ensureProjectOwnership (pool)

      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        query: jest
          .fn()
          .mockResolvedValueOnce([[]]) // SELECT existing ids (none kept)
          .mockResolvedValueOnce([{}]) // DELETE all
          .mockResolvedValueOnce([{}]) // INSERT new color
          .mockResolvedValueOnce([{}]) // UPDATE projects.last_edited
          .mockResolvedValueOnce([[{ id: 20, name: 'X', hex: '#000000' }]]), // SELECT canonical palette
      };
      db.getConnection.mockResolvedValue(connection);

      const req = {
        params: { id: '1' },
        user: { id: 1 },
        body: [{ name: 'X', hex: '#000000' }],
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await projectsController.updatePalette(req, res);

      expect(connection.query).toHaveBeenNthCalledWith(
        2,
        'UPDATE project_palette SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL',
        ['1'],
      );
      expect(connection.commit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        palette: [{ id: 20, name: 'X', hex: '#000000' }],
      });
    });
  });

  describe('create project', () => {
    it('returns 401 when the user is not authenticated', async () => {
      const req = { body: { name: 'My Project' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.createProject(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 400 when the name is missing', async () => {
      const req = { user: { id: 1 }, body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.createProject(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Required fields are missing.' });
    });

    it('returns 400 for an invalid (too short) name without touching the DB', async () => {
      const req = { user: { id: 1 }, body: { name: 'A' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.createProject(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project name.' });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('creates a project and returns 201', async () => {
      db.query.mockResolvedValueOnce([{ insertId: 7 }]);
      const req = { user: { id: 1 }, body: { name: '  My Project  ' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.createProject(req, res);
      expect(db.query).toHaveBeenCalledWith('INSERT INTO projects (user_id, name) VALUES (?, ?)', [
        1,
        'My Project',
      ]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 7, name: 'My Project' }));
    });
  });

  describe('duplicate project', () => {
    const makeConnection = () => ({
      query: jest.fn().mockResolvedValue([{}]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    });

    it('duplicates a project with its norms and palette in a transaction', async () => {
      db.query.mockResolvedValueOnce([[{ id: 5 }]]); // ownership check
      db.query.mockResolvedValueOnce([[{ name: 'Neo-Tokyo' }]]); // source name
      const connection = makeConnection();
      connection.query.mockResolvedValueOnce([{ insertId: 42 }]); // INSERT projects
      db.getConnection.mockResolvedValueOnce(connection);
      // Read-back of the copied children (new server-assigned ids).
      db.query.mockResolvedValueOnce([
        [{ id: 7, name: 'Outline', value: '8', unit: 'px', brush_name: 'Smooth', opacity: 80 }],
      ]);
      db.query.mockResolvedValueOnce([
        [
          {
            id: 8,
            font_family: 'Figtree',
            font_weight: '600',
            font_usage: 'Heading',
            font_style: null,
          },
        ],
      ]);
      db.query.mockResolvedValueOnce([[{ id: 9, name: 'Ink', hex: '#112233' }]]);

      const req = { user: { id: 1 }, params: { id: '5' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.duplicateProject(req, res);

      expect(connection.beginTransaction).toHaveBeenCalled();
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      // The three child tables are copied via INSERT ... SELECT.
      expect(connection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO project_brush_norms'),
        [42, '5'],
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          name: 'Neo-Tokyo (copy)',
          normsCount: 2,
          palette: [{ id: 9, name: 'Ink', hex: '#112233' }],
        }),
      );
    });

    it('rolls back and releases the connection when a copy fails', async () => {
      db.query.mockResolvedValueOnce([[{ id: 5 }]]); // ownership check
      db.query.mockResolvedValueOnce([[{ name: 'Neo-Tokyo' }]]); // source name
      const connection = makeConnection();
      connection.query.mockResolvedValueOnce([{ insertId: 42 }]);
      connection.query.mockRejectedValueOnce(new Error('copy failed'));
      db.getConnection.mockResolvedValueOnce(connection);

      const req = { user: { id: 1 }, params: { id: '5' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.duplicateProject(req, res);

      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("forbids duplicating another user's project", async () => {
      db.query.mockResolvedValueOnce([[]]); // ownership check fails
      const req = { user: { id: 1 }, params: { id: '5' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.duplicateProject(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(db.getConnection).not.toHaveBeenCalled();
    });
  });

  describe('rename project', () => {
    it('returns 400 for an empty name', async () => {
      const req = { params: { id: '1' }, user: { id: 1 }, body: { name: '   ' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.updateProjectName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project name is required.' });
    });

    it('returns 403 when the user does not own the project', async () => {
      db.query.mockResolvedValueOnce([[]]); // userOwnsProject -> not owned
      const req = { params: { id: '1' }, user: { id: 1 }, body: { name: 'New Name' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.updateProjectName(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('renames the project when owned', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{}]); // UPDATE projects
      const req = { params: { id: '1' }, user: { id: 1 }, body: { name: 'New Name' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.updateProjectName(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, name: 'New Name' });
    });
  });

  describe('delete project', () => {
    it('returns 403 when the user does not own the project', async () => {
      db.query.mockResolvedValueOnce([[]]);
      const req = { params: { id: '1' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteProject(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('moves the project to the trash (soft delete) when owned', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{}]); // soft-delete UPDATE
      const req = { params: { id: '1' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteProject(req, res);
      // Soft delete: the row is stamped, never dropped here.
      expect(db.query).toHaveBeenCalledWith('UPDATE projects SET deleted_at = NOW() WHERE id = ?', [
        '1',
      ]);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('trash', () => {
    it('lists the trashed projects with their days left', async () => {
      db.query.mockResolvedValueOnce([
        [{ id: 3, name: 'Old project', deleted_at: '2026-07-01 10:00:00', days_left: '12' }],
      ]);
      const req = { user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.listTrashedProjects(req, res);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NOT NULL'),
        [30, 1],
      );
      expect(res.json).toHaveBeenCalledWith({
        projects: [{ id: 3, name: 'Old project', deletedAt: '2026-07-01 10:00:00', daysLeft: 12 }],
      });
    });

    it('restores a trashed project scoped to its owner', async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { id: '3' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.restoreProject(req, res);
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE projects SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
        ['3', 1],
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("returns 404 when restoring a project that is not in the user's trash", async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
      const req = { params: { id: '3' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.restoreProject(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('permanently deletes only a trashed project owned by the user', async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { id: '3' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteProjectPermanently(req, res);
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
        ['3', 1],
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns 404 when permanently deleting a project that is not trashed', async () => {
      db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
      const req = { params: { id: '3' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteProjectPermanently(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('public sharing', () => {
    it('enables sharing and returns the stable token (idempotent COALESCE)', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 5 }]]) // ownership
        .mockResolvedValueOnce([{}]) // COALESCE UPDATE
        .mockResolvedValueOnce([[{ share_token: 'a'.repeat(32) }]]); // read back
      const req = { params: { id: '5' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.enableSharing(req, res);
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE projects SET share_token = COALESCE(share_token, ?) WHERE id = ?',
        [expect.stringMatching(/^[a-f0-9]{32}$/), '5'],
      );
      expect(res.json).toHaveBeenCalledWith({ shareToken: 'a'.repeat(32) });
    });

    it('disables sharing (revokes the link)', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 5 }]]) // ownership
        .mockResolvedValueOnce([{}]); // UPDATE NULL
      const req = { params: { id: '5' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.disableSharing(req, res);
      expect(db.query).toHaveBeenCalledWith('UPDATE projects SET share_token = NULL WHERE id = ?', [
        '5',
      ]);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('serves a shared reference sheet publicly, with only the owner display name', async () => {
      const token = 'b'.repeat(32);
      db.query
        .mockResolvedValueOnce([[{ id: 5, name: 'Neo-Tokyo', owner_name: 'Axelle' }]]) // token lookup
        .mockResolvedValueOnce([
          [{ id: 7, name: 'Outline', value: '8', unit: 'px', brush_name: 'Smooth', opacity: 80 }],
        ])
        .mockResolvedValueOnce([
          [
            {
              id: 8,
              font_family: 'Figtree',
              font_weight: '600',
              font_usage: 'Heading',
              font_style: null,
            },
          ],
        ])
        .mockResolvedValueOnce([[{ id: 9, name: 'Ink', hex: '#112233' }]]);
      const req = { params: { token } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.getSharedProject(req, res);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'), [token]);
      const payload = res.json.mock.calls[0][0];
      expect(payload).toEqual({
        name: 'Neo-Tokyo',
        ownerName: 'Axelle',
        brushNorms: [
          { id: 7, name: 'Outline', value: '8', unit: 'px', brushName: 'Smooth', opacity: 80 },
        ],
        typographyNorms: [
          {
            id: 8,
            fontFamily: 'Figtree',
            fontWeight: '600',
            fontUsage: 'Heading',
            fontStyle: null,
          },
        ],
        palette: [{ id: 9, name: 'Ink', hex: '#112233' }],
      });
      // The public payload leaks only the owner's display name (a "Made by"
      // credit) — never their id, email or the project's id.
      expect(payload.id).toBeUndefined();
      expect(payload.userId).toBeUndefined();
      expect(payload.email).toBeUndefined();
    });

    it('returns 404 for a malformed token without touching the database', async () => {
      const req = { params: { token: 'not-a-token' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.getSharedProject(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown or revoked token', async () => {
      db.query.mockResolvedValueOnce([[]]);
      const req = { params: { token: 'c'.repeat(32) } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.getSharedProject(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('delete norms', () => {
    it('deletes a brush norm when it exists', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE brush norm
      const req = { params: { projectId: '1', normId: '9' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteBrushNorm(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns 404 when the brush norm does not exist', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 0 }]); // DELETE matched nothing
      const req = { params: { projectId: '1', normId: '99' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteBrushNorm(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Standard not found.' });
    });

    it('deletes a typography norm when it exists', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE typography norm
      const req = { params: { projectId: '1', normId: '9' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteTypographyNorm(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('norms trash', () => {
    it("lists a project's trashed brush norms with days left", async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([
          [
            {
              id: 9,
              name: 'Outline',
              value: '8',
              unit: 'px',
              brush_name: 'Smooth',
              opacity: 0.5,
              deleted_at: '2026-07-01',
              days_left: '20',
            },
          ],
        ]);
      const req = { params: { projectId: '1' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.listTrashedBrushNorms(req, res);
      expect(res.json).toHaveBeenCalledWith({
        norms: [
          {
            id: 9,
            name: 'Outline',
            value: '8',
            unit: 'px',
            brushName: 'Smooth',
            opacity: 0.5,
            deletedAt: '2026-07-01',
            daysLeft: 20,
          },
        ],
      });
    });

    it('restores a trashed brush norm scoped to its project', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { projectId: '1', normId: '9' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.restoreBrushNorm(req, res);
      expect(db.query).toHaveBeenLastCalledWith(
        'UPDATE project_brush_norms SET deleted_at = NULL WHERE id = ? AND project_id = ? AND deleted_at IS NOT NULL',
        ['9', '1'],
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns 404 when restoring a brush norm that is not in the trash', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 0 }]);
      const req = { params: { projectId: '1', normId: '9' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.restoreBrushNorm(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('permanently deletes a trashed brush norm', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { projectId: '1', normId: '9' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteBrushNormPermanently(req, res);
      expect(db.query).toHaveBeenLastCalledWith(
        'DELETE FROM project_brush_norms WHERE id = ? AND project_id = ? AND deleted_at IS NOT NULL',
        ['9', '1'],
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("lists a project's trashed typography norms with days left", async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([
          [
            {
              id: 4,
              font_family: 'Figtree',
              font_weight: '600',
              font_usage: 'Heading',
              font_style: null,
              deleted_at: '2026-07-01',
              days_left: '5',
            },
          ],
        ]);
      const req = { params: { projectId: '1' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.listTrashedTypographyNorms(req, res);
      expect(res.json).toHaveBeenCalledWith({
        norms: [
          {
            id: 4,
            fontFamily: 'Figtree',
            fontWeight: '600',
            fontUsage: 'Heading',
            fontStyle: null,
            deletedAt: '2026-07-01',
            daysLeft: 5,
          },
        ],
      });
    });

    it('restores a trashed typography norm', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { projectId: '1', normId: '4' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.restoreTypographyNorm(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('permanently deletes a trashed typography norm', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { projectId: '1', normId: '4' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deleteTypographyNormPermanently(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('palette color trash', () => {
    it('moves a single color to the trash (soft delete), scoped to the project', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { id: '1', colorId: '10' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deletePaletteColor(req, res);
      expect(db.query).toHaveBeenLastCalledWith(
        'UPDATE project_palette SET deleted_at = NOW() WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
        ['10', '1'],
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns 404 when deleting a color that does not exist', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 0 }]);
      const req = { params: { id: '1', colorId: '99' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deletePaletteColor(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("lists a project's trashed colors with days left", async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([
          [{ id: 10, name: 'Ink', hex: '#112233', deleted_at: '2026-07-01', days_left: '18' }],
        ]);
      const req = { params: { id: '1' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.listTrashedPaletteColors(req, res);
      expect(res.json).toHaveBeenCalledWith({
        colors: [{ id: 10, name: 'Ink', hex: '#112233', deletedAt: '2026-07-01', daysLeft: 18 }],
      });
    });

    it('restores a trashed color', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { id: '1', colorId: '10' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.restorePaletteColor(req, res);
      expect(db.query).toHaveBeenLastCalledWith(
        'UPDATE project_palette SET deleted_at = NULL WHERE id = ? AND project_id = ? AND deleted_at IS NOT NULL',
        ['10', '1'],
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns 404 when restoring a color that is not in the trash', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 0 }]);
      const req = { params: { id: '1', colorId: '10' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.restorePaletteColor(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('permanently deletes a trashed color', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { params: { id: '1', colorId: '10' }, user: { id: 1 } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.deletePaletteColorPermanently(req, res);
      expect(db.query).toHaveBeenLastCalledWith(
        'DELETE FROM project_palette WHERE id = ? AND project_id = ? AND deleted_at IS NOT NULL',
        ['10', '1'],
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('update norms', () => {
    it('returns 403 when updating a brush norm on a non-owned project', async () => {
      db.query.mockResolvedValueOnce([[]]); // not owned
      const req = {
        params: { projectId: '1', normId: '9' },
        user: { id: 1 },
        body: { name: 'Outline', value: '8', unit: 'px', brushName: 'Smooth' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.updateBrushNorm(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('updates a brush norm when owned and existing', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE norm
        .mockResolvedValueOnce([{}]); // UPDATE projects.last_edited
      const req = {
        params: { projectId: '1', normId: '9' },
        user: { id: 1 },
        body: { name: 'Outline', value: '8', unit: 'px', brushName: 'Smooth' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.updateBrushNorm(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns 404 when the brush norm to update does not exist', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 0 }]); // UPDATE matched nothing
      const req = {
        params: { projectId: '1', normId: '99' },
        user: { id: 1 },
        body: { name: 'Outline', value: '8', unit: 'px', brushName: 'Smooth' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.updateBrushNorm(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates a typography norm when owned and existing', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // ownership
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE norm
        .mockResolvedValueOnce([{}]); // UPDATE projects.last_edited
      const req = {
        params: { projectId: '1', normId: '9' },
        user: { id: 1 },
        body: { fontFamily: 'Inter', fontWeight: '700', fontUsage: 'Heading', fontStyle: 'Normal' },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await projectsController.updateTypographyNorm(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
