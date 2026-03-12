const mockQuery = jest.fn((sql) => {
  if (sql && typeof sql === 'string' && sql.includes('SELECT filename')) {
    return Promise.resolve([[{ filename: '001_init.sql' }]]);
  }
  return Promise.resolve([[]]);
});

const mockPool = { query: mockQuery, end: jest.fn() };
const mockCreatePool = jest.fn(() => mockPool);
const mockExistsSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockReadFileSync = jest.fn(() => 'SQL');

jest.mock('mysql2/promise', () => ({
  createPool: (...args) => mockCreatePool(...args)
}));

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  readFileSync: (...args) => mockReadFileSync(...args)
}));
const migrate = require('../../src/migrate');

describe('migrations', () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockPool.end.mockClear();
    mockCreatePool.mockClear();
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    mockReadFileSync.mockReturnValue('SQL');
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

  it('devrait exécuter les migrations en attente et les enregistrer', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['001_init.sql', '002_add_password_updated_at.sql']);
    mockReadFileSync.mockImplementation((filePath) => {
      if (String(filePath).includes('002_add_password_updated_at.sql')) {
        return 'ALTER TABLE users ADD COLUMN password_updated_at TIMESTAMP NULL';
      }
      return 'SQL';
    });

    await migrate.run(mockPool);

    expect(mockQuery).toHaveBeenCalledWith(
      'ALTER TABLE users ADD COLUMN password_updated_at TIMESTAMP NULL'
    );
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
      ['002_add_password_updated_at.sql']
    );
    expect(mockPool.end).not.toHaveBeenCalled();
  });

  it('devrait marquer une migration comme appliquée si le schéma existe déjà', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['001_init.sql', '002_add_password_updated_at.sql']);
    mockReadFileSync.mockReturnValue('ALTER TABLE users ADD COLUMN password_updated_at DATETIME');

    mockQuery.mockImplementation((sql) => {
      if (sql && typeof sql === 'string' && sql.includes('SELECT filename')) {
        return Promise.resolve([[{ filename: '001_init.sql' }]]);
      }
      if (sql && typeof sql === 'string' && sql.includes('ALTER TABLE users ADD COLUMN password_updated_at')) {
        const error = new Error('duplicate field');
        error.code = 'ER_DUP_FIELDNAME';
        return Promise.reject(error);
      }
      return Promise.resolve([[]]);
    });

    await expect(migrate.run(mockPool)).resolves.not.toThrow();
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
      ['002_add_password_updated_at.sql']
    );
  });

  it('devrait fermer le pool créé automatiquement', async () => {
    mockExistsSync.mockReturnValue(false);

    await migrate.run();

    expect(mockCreatePool).toHaveBeenCalled();
    expect(mockPool.end).toHaveBeenCalledTimes(1);
  });
});

