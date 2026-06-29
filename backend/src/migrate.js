/**
 * Database migration runner.
 *
 * Applies pending .sql files from the migrations directory in filename order,
 * tracking what has run in a schema_migrations table so each file executes at
 * most once. Certain "already reflected" errors (e.g. column/key already
 * exists) are tolerated to keep migrations idempotent against a partially
 * migrated schema. Runnable directly via `node migrate.js` or importable for
 * use in tests/bootstrapping.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();
const { logger } = require('./utils/logger');

const migrationsDir = path.join(__dirname, '..', 'migrations');
// Errors that mean the change is already present; safe to skip rather than fail.
const SKIPPABLE_MIGRATION_ERROR_CODES = new Set([
  'ER_DUP_FIELDNAME',
  'ER_CANT_DROP_FIELD_OR_KEY',
  'ER_TABLE_EXISTS_ERROR',
  'ER_DUP_KEYNAME'
]);
const migrationLogger = logger.child({ component: 'migrations' });

/**
 * Creates a dedicated migration pool. multipleStatements is enabled so a single
 * .sql file containing several statements can be executed in one query call.
 * @returns {import('mysql2/promise').Pool}
 */
const getPool = () => mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'frameset_db',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  multipleStatements: true
});

/**
 * Runs a task with a pool, creating an ephemeral pool when none is supplied and
 * closing only the pool it created. This lets callers either share an existing
 * pool or run standalone without leaking connections.
 * @param {import('mysql2/promise').Pool|undefined} pool Optional existing pool.
 * @param {(pool: import('mysql2/promise').Pool) => Promise<*>} task Work to run.
 * @returns {Promise<*>} The task's result.
 */
const runWithPool = async (pool, task) => {
  const resolvedPool = pool || getPool();
  const shouldClosePool = !pool;

  try {
    return await task(resolvedPool);
  } finally {
    if (shouldClosePool) {
      await resolvedPool.end();
    }
  }
};

/**
 * Creates the schema_migrations bookkeeping table if it does not already exist.
 * @param {import('mysql2/promise').Pool} [pool] Optional existing pool.
 * @returns {Promise<void>}
 */
const ensureMigrationsTable = async (pool) => {
  await runWithPool(pool, async (resolvedPool) => {
    await resolvedPool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT NOT NULL AUTO_INCREMENT,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  });
};

/**
 * Computes the ordered list of migration files that have not yet been applied,
 * by diffing the on-disk .sql files against the recorded filenames.
 * @param {import('mysql2/promise').Pool} [pool] Optional existing pool.
 * @returns {Promise<string[]>} Pending migration filenames, sorted.
 */
const getPendingMigrations = async (pool) => {
  return runWithPool(pool, async (resolvedPool) => {
    const [rows] = await resolvedPool.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    if (!fs.existsSync(migrationsDir)) {
      return [];
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    return files.filter((f) => !applied.has(f));
  });
};

/**
 * Applies all pending migrations in order. Each file is executed and then
 * recorded in schema_migrations (INSERT IGNORE) so it is not re-run. Empty files
 * are recorded and skipped; "already reflected" errors are tolerated. On an
 * unexpected error the process exit code is set to 1 so CI can detect failure.
 * @param {import('mysql2/promise').Pool} [pool] Optional existing pool.
 * @returns {Promise<void>}
 */
const run = async (pool) => {
  const resolvedPool = pool || getPool();
  const shouldClosePool = !pool;

  try {
    await ensureMigrationsTable(resolvedPool);
    const pending = await getPendingMigrations(resolvedPool);

    if (pending.length === 0) {
      migrationLogger.info('migrations.none_pending');
      return;
    }

    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8').trim();

      if (!sql) {
        migrationLogger.warn('migrations.empty_skipped', { file });
        await resolvedPool.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
        continue;
      }

      migrationLogger.info('migrations.execute', { file });
      try {
        await resolvedPool.query(sql);
        migrationLogger.info('migrations.applied', { file });
      } catch (error) {
        if (!SKIPPABLE_MIGRATION_ERROR_CODES.has(error?.code)) {
          throw error;
        }

        migrationLogger.warn('migrations.already_reflected', {
          file,
          errorCode: error.code
        });
      }

      await resolvedPool.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
    }
  } catch (error) {
    migrationLogger.error('migrations.run.error', { error });
    process.exitCode = 1;
  } finally {
    if (shouldClosePool) {
      await resolvedPool.end();
    }
  }
};

// Run migrations automatically only when invoked directly (not when imported).
if (require.main === module) {
  run();
}

module.exports = {
  ensureMigrationsTable,
  getPendingMigrations,
  run
};
