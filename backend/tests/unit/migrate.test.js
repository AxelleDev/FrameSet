const mockQuery = jest.fn((sql) => {
  if (sql && typeof sql === 'string' && sql.includes('SELECT filename')) {
    return Promise.resolve([[{ filename: '001_init.sql' }]]);
  }
  return Promise.resolve([[]]);
});

const mockPool = { query: mockQuery, end: jest.fn() };
const mockExistsSync = jest.fn();
const mockReaddirSync = jest.fn();
jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  readFileSync: jest.fn(() => 'SQL')
}));
const migrate = require('../../src/migrate');

describe('migrate.js', () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
  });

  it('should create migrations table', async () => {
    await expect(migrate.ensureMigrationsTable(mockPool)).resolves.not.toThrow();
  });

  it('should return empty array if migrations dir does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await migrate.getPendingMigrations(mockPool);
    expect(result).toEqual([]);
  });

  it('should filter .sql files in migrations dir', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['001_init.sql', 'not_a_sql.txt']);
    mockQuery.mockResolvedValue([[]]); // Simule la réponse de la BDD
    const result = await migrate.getPendingMigrations(mockPool);
    expect(result).toContain('001_init.sql');
    expect(result).not.toContain('not_a_sql.txt');
  });
});

