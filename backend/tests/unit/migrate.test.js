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

  it('creates the migrations table', async () => {
    await expect(migrate.ensureMigrationsTable(mockPool)).resolves.not.toThrow();
  });

  it('returns an empty array when the migrations folder does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await migrate.getPendingMigrations(mockPool);
    expect(result).toEqual([]);
  });

  it('filters the .sql files in the migrations folder', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['001_init.sql', 'not_a_sql.txt']);
    mockQuery.mockResolvedValue([[]]); // Simulate the database response
    const result = await migrate.getPendingMigrations(mockPool);
    expect(result).toContain('001_init.sql');
    expect(result).not.toContain('not_a_sql.txt');
  });

  it('runs the pending migrations and records them', async () => {
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

  it('marks a migration as applied when the schema already exists', async () => {
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

  it('closes the automatically created pool', async () => {
    mockExistsSync.mockReturnValue(false);

    await migrate.run();

    expect(mockCreatePool).toHaveBeenCalled();
    expect(mockPool.end).toHaveBeenCalledTimes(1);
  });
});

