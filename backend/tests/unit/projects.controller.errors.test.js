/**
 * Systematic error-path battery for the projects controller: every handler
 * must (1) reject an unauthenticated request with 401 before touching the
 * database, and (2) map an unexpected database failure to a clean 500 —
 * never leak the raw error. Table-driven so a future handler added to the
 * controller without these guarantees fails loudly here.
 */
const projectsController = require('../../src/controllers/projects.controller');
const db = require('../../src/database');

jest.mock('../../src/database');

const makeRes = () => ({
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
  set: jest.fn(),
  send: jest.fn(),
});

// Handler name -> a request shaped for it (no `user` — added per test).
const AUTHENTICATED_HANDLERS = {
  listProjects: { query: {} },
  getProject: { params: { id: '1' } },
  searchProjects: { query: { q: 'x' } },
  createProject: { body: { name: 'Projet' } },
  duplicateProject: { params: { id: '1' } },
  pinProject: { params: { id: '1' } },
  unpinProject: { params: { id: '1' } },
  reorderPinnedProjects: { body: [1] },
  enableSharing: { params: { id: '1' } },
  disableSharing: { params: { id: '1' } },
  updateProjectName: { params: { id: '1' }, body: { name: 'New name' } },
  deleteProject: { params: { id: '1' } },
  listTrashedProjects: { query: {} },
  restoreProject: { params: { id: '1' } },
  deleteProjectPermanently: { params: { id: '1' } },
  addBrushNorm: { params: { id: '1' }, body: { name: 'Line', value: '8', unit: 'px' } },
  addTypographyNorm: {
    params: { id: '1' },
    body: { fontFamily: 'Figtree', fontWeight: '400', fontUsage: 'Body' },
  },
  updatePalette: { params: { id: '1' }, body: [{ name: 'Ink', hex: '#112233' }] },
  reorderBrushNorms: { params: { id: '1' }, body: { orderedIds: [1] } },
  reorderTypographyNorms: { params: { id: '1' }, body: { orderedIds: [1] } },
  deleteBrushNorm: { params: { id: '1', normId: '2' } },
  deleteTypographyNorm: { params: { id: '1', normId: '2' } },
  listTrashedBrushNorms: { params: { id: '1' } },
  restoreBrushNorm: { params: { id: '1', normId: '2' } },
  deleteBrushNormPermanently: { params: { id: '1', normId: '2' } },
  listTrashedTypographyNorms: { params: { id: '1' } },
  restoreTypographyNorm: { params: { id: '1', normId: '2' } },
  deleteTypographyNormPermanently: { params: { id: '1', normId: '2' } },
  deletePaletteColor: { params: { id: '1', colorId: '2' } },
  listTrashedPaletteColors: { params: { id: '1' } },
  restorePaletteColor: { params: { id: '1', colorId: '2' } },
  deletePaletteColorPermanently: { params: { id: '1', colorId: '2' } },
  updateBrushNorm: { params: { id: '1', normId: '2' }, body: { name: 'L', value: '9' } },
  updateTypographyNorm: {
    params: { id: '1', normId: '2' },
    body: { fontFamily: 'Figtree', fontWeight: '400', fontUsage: 'Body' },
  },
};

describe('projects controller error paths (table-driven)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe.each(Object.entries(AUTHENTICATED_HANDLERS))('%s', (name, baseReq) => {
    it('rejects an unauthenticated request with 401 without touching the database', async () => {
      const res = makeRes();
      await projectsController[name]({ ...baseReq }, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not authenticated.' });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('maps an unexpected database failure to a clean 500', async () => {
      db.query.mockRejectedValue(new Error('connection lost'));
      db.getConnection.mockRejectedValue(new Error('connection lost'));
      const res = makeRes();
      await projectsController[name]({ ...baseReq, user: { id: 1 } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      // Whatever the handler's wording, the raw driver error never leaks.
      const payload = res.json.mock.calls.at(-1)[0];
      expect(payload.error).toMatch(/error/i);
      expect(JSON.stringify(payload)).not.toContain('connection lost');
    });
  });
});
