jest.mock('../../src/database');

const db = require('../../src/database');
const { escapeLikeWildcards, listProjectsForUser } = require('../../src/services/projects.service');

describe('projects service — search wildcard escaping', () => {
  describe('escapeLikeWildcards', () => {
    it('escapes the LIKE metacharacters % and _', () => {
      expect(escapeLikeWildcards('50%_done')).toBe('50\\%\\_done');
    });

    it('escapes the escape character itself so it cannot un-escape a wildcard', () => {
      expect(escapeLikeWildcards('a\\%b')).toBe('a\\\\\\%b');
    });

    it('leaves ordinary search terms untouched', () => {
      expect(escapeLikeWildcards('My project')).toBe('My project');
    });
  });

  describe('listProjectsForUser', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('binds an escaped LIKE pattern so "%" searches literally instead of matching everything', async () => {
      // COUNT query, then the (empty) page query — no projects, so no child fetches.
      db.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await listProjectsForUser(1, 'req-test', { search: '100%' });

      const [, countParams] = db.query.mock.calls[0];
      expect(countParams).toEqual([1, '%100\\%%']);
    });
  });
});
