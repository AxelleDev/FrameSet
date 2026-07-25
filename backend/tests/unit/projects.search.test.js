/**
 * Global search (GET /api/projects/search): one query matched against the
 * user's project names, palette colors (name or hex) and standards. Every SQL
 * query MUST be scoped to the authenticated user — the search must never see
 * another user's content — and LIKE wildcards in the query must be escaped.
 */

jest.mock('../../src/database', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

const db = require('../../src/database');
const projectsController = require('../../src/controllers/projects.controller');

const buildRes = () => ({ json: jest.fn(), status: jest.fn().mockReturnThis() });

describe('search projects content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns grouped matches across projects, colors and standards', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Alyse Emotes' }]]) // projects
      .mockResolvedValueOnce([
        [{ id: 4, name: 'Blush', hex: '#FCBFC4', project_id: 1, project_name: 'Alyse Emotes' }],
      ]) // colors
      .mockResolvedValueOnce([
        [
          {
            id: 7,
            name: 'Hair Lineart',
            brush_name: 'Smooth',
            project_id: 1,
            project_name: 'Alyse Emotes',
          },
        ],
      ]) // brush norms
      .mockResolvedValueOnce([
        [
          {
            id: 9,
            font_family: 'Parisienne',
            font_usage: 'Titres',
            project_id: 1,
            project_name: 'Alyse Emotes',
          },
        ],
      ]); // typography norms

    const req = { user: { id: 42 }, query: { q: 'a' } };
    const res = buildRes();
    await projectsController.searchProjects(req, res);

    expect(res.json).toHaveBeenCalledWith({
      projects: [{ id: 1, name: 'Alyse Emotes' }],
      colors: [{ id: 4, name: 'Blush', hex: '#FCBFC4', projectId: 1, projectName: 'Alyse Emotes' }],
      brushNorms: [
        {
          id: 7,
          name: 'Hair Lineart',
          brushName: 'Smooth',
          projectId: 1,
          projectName: 'Alyse Emotes',
        },
      ],
      typographyNorms: [
        {
          id: 9,
          fontFamily: 'Parisienne',
          fontUsage: 'Titres',
          projectId: 1,
          projectName: 'Alyse Emotes',
        },
      ],
    });

    // SECURITY: every one of the four queries is scoped to the caller's id.
    expect(db.query).toHaveBeenCalledTimes(4);
    for (const [, params] of db.query.mock.calls) {
      expect(params[0]).toBe(42);
    }
  });

  it('escapes LIKE wildcards so "50%" matches literally', async () => {
    db.query.mockResolvedValue([[]]);

    const req = { user: { id: 42 }, query: { q: '50%' } };
    await projectsController.searchProjects(req, buildRes());

    const [, params] = db.query.mock.calls[0];
    expect(params).toContain('%50\\%%');
  });

  it('rejects a missing or blank query with 400, without touching the DB', async () => {
    const res = buildRes();
    await projectsController.searchProjects({ user: { id: 42 }, query: { q: '   ' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects a query above 100 characters with 400', async () => {
    const res = buildRes();
    await projectsController.searchProjects(
      { user: { id: 42 }, query: { q: 'x'.repeat(101) } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = buildRes();
    await projectsController.searchProjects({ query: { q: 'a' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
