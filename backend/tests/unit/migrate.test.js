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

describe('migrations', () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
  });

  it('devrait créer la table des migrations', async () => {
    await expect(migrate.ensureMigrationsTable(mockPool)).resolves.not.toThrow();
  });

  it('devrait retourner un tableau vide si le dossier des migrations n’existe pas', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await migrate.getPendingMigrations(mockPool);
    expect(result).toEqual([]);
  });

  it('devrait filtrer les fichiers .sql dans le dossier des migrations', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['001_init.sql', 'not_a_sql.txt']);
    mockQuery.mockResolvedValue([[]]); // Simule la réponse de la BDD
    const result = await migrate.getPendingMigrations(mockPool);
    expect(result).toContain('001_init.sql');
    expect(result).not.toContain('not_a_sql.txt');
  });
});

