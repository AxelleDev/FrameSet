const projectsController = require('../../src/controllers/projects.controller');
const db = require('../../src/database');

jest.mock('../../src/database');

describe('projects.controller', () => {
  const projectsController = require('../../src/controllers/projects.controller');
  const db = require('../../src/database');
  jest.mock('../../src/database');

  describe('listProjects', () => {
    it('should return empty array if no userId', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };
      await projectsController.listProjects(req, res);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should return projects for user', async () => {
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
