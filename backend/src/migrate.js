/**
 * Migration runner: applies pending .sql files in filename order, tracked in
 * schema_migrations so each runs at most once. "Already reflected" errors are
 * tolerated for idempotency. Run via `node migrate.js` or import for tests.
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

// Dedicated migration pool. multipleStatements is enabled so a single .sql file
// with several statements runs in one query call.
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

// Runs a task with a pool, creating an ephemeral one when none is supplied and
// closing only the pool it created (so callers can share a pool without leaks).
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

// Creates the schema_migrations bookkeeping table if absent.
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

// Sorted list of unapplied migrations: on-disk .sql files minus recorded filenames.
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

// Applies pending migrations in order, recording each (INSERT IGNORE) so it is
// not re-run. Empty files are skipped; "already reflected" errors tolerated.
// Sets process exit code 1 on unexpected error so CI can detect failure.
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
    // Rethrow so a programmatic caller (tests, JS deploy script) sees the failure
    // rather than assuming success from a resolved promise.
    throw error;
  } finally {
    if (shouldClosePool) {
      await resolvedPool.end();
    }
  }
};

// Run migrations automatically only when invoked directly (not when imported). The
// error is already logged and process.exitCode is set inside run(); swallow the
// rejection here so the CLI exits non-zero without an unhandled-rejection trace.
if (require.main === module) {
  run().catch(() => {});
}

module.exports = {
  ensureMigrationsTable,
  getPendingMigrations,
  run
};
