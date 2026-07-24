/**
 * Database backup: dumps the MySQL database to a gzipped SQL file and prunes
 * backups older than the retention window. Run via `npm run backup` (or
 * directly with node) and schedule it (cron / Task Scheduler / your host's
 * scheduled jobs) — see the "Backups" section of the README.
 *
 * Design notes:
 * - Requires the `mysqldump` client binary on PATH (ships with MySQL/MariaDB).
 * - The password is passed via the MYSQL_PWD environment variable of the child
 *   process, never as a CLI argument, so it cannot leak through a process list.
 * - The dump is written to a *.partial file and only renamed to its final name
 *   on success, so an interrupted run can never be mistaken for a valid backup.
 * - --single-transaction takes a consistent InnoDB snapshot without locking
 *   the tables, so a backup never blocks the live API.
 */

const { spawn } = require('child_process');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { logger } = require('../src/utils/logger');

const backupLogger = logger.child({ component: 'db_backup' });

// How long backup files are kept before being pruned by the next run.
const DEFAULT_RETENTION_DAYS = 14;
// Default target directory (gitignored); override with BACKUP_DIR.
const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', 'backups');

const getConfig = () => {
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS);

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'frameset_db',
    backupDir: process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR,
    retentionDays:
      Number.isInteger(retentionDays) && retentionDays > 0 ? retentionDays : DEFAULT_RETENTION_DAYS,
  };
};

// mysqldump arguments for a consistent, restore-friendly dump. The password is
// deliberately absent (see MYSQL_PWD note above).
const buildDumpArgs = ({ host, port, user, database }) => [
  `--host=${host}`,
  `--port=${port}`,
  `--user=${user}`,
  // Consistent snapshot without table locks (InnoDB).
  '--single-transaction',
  // Include stored routines and triggers so a restore rebuilds everything.
  '--routines',
  '--triggers',
  database,
];

// Backup file name: <database>-<UTC timestamp>.sql.gz, filesystem-safe.
const makeBackupFileName = (database, now = new Date()) => {
  const timestamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/:/g, '-');
  return `${database}-${timestamp}.sql.gz`;
};

// A backup is expired when its mtime is past the retention window.
const isExpiredBackup = (mtimeMs, nowMs, retentionDays) =>
  nowMs - mtimeMs > retentionDays * 24 * 60 * 60 * 1000;

// Runs mysqldump and streams stdout → gzip → file. Rejects on spawn failure,
// non-zero exit, or a stream error; the caller cleans up the partial file.
const runDump = (config, partialFilePath) =>
  new Promise((resolve, reject) => {
    const dump = spawn('mysqldump', buildDumpArgs(config), {
      env: { ...process.env, MYSQL_PWD: config.password },
    });

    let stderrOutput = '';
    dump.stderr.on('data', (chunk) => {
      stderrOutput += chunk;
    });

    // Collect the pipeline and the child's exit code; fail on either error.
    const streamDone = pipeline(dump.stdout, createGzip(), fs.createWriteStream(partialFilePath));

    dump.on('error', (error) => {
      // Typically ENOENT: the mysqldump binary is not installed / not on PATH.
      reject(new Error(`Failed to start mysqldump: ${error.message}`));
    });

    dump.on('close', (exitCode) => {
      streamDone
        .then(() => {
          if (exitCode !== 0) {
            reject(new Error(`mysqldump exited with code ${exitCode}: ${stderrOutput.trim()}`));
            return;
          }
          resolve();
        })
        .catch(reject);
    });
  });

// Deletes backups past the retention window. Only touches files matching this
// database's backup naming pattern, so unrelated files in the directory survive.
const pruneExpiredBackups = (config, nowMs = Date.now()) => {
  const backupFilePattern = new RegExp(`^${config.database}-.*\\.sql\\.gz$`);
  const removedFiles = [];

  for (const fileName of fs.readdirSync(config.backupDir)) {
    if (!backupFilePattern.test(fileName)) {
      continue;
    }

    const filePath = path.join(config.backupDir, fileName);
    const { mtimeMs } = fs.statSync(filePath);
    if (isExpiredBackup(mtimeMs, nowMs, config.retentionDays)) {
      fs.unlinkSync(filePath);
      removedFiles.push(fileName);
    }
  }

  return removedFiles;
};

const runBackup = async () => {
  const config = getConfig();
  fs.mkdirSync(config.backupDir, { recursive: true });

  const fileName = makeBackupFileName(config.database);
  const filePath = path.join(config.backupDir, fileName);
  const partialFilePath = `${filePath}.partial`;

  backupLogger.info('db_backup.started', {
    database: config.database,
    file: fileName,
    retentionDays: config.retentionDays,
  });

  try {
    await runDump(config, partialFilePath);
    fs.renameSync(partialFilePath, filePath);
  } catch (error) {
    // Never leave a broken file that looks like a backup.
    fs.rmSync(partialFilePath, { force: true });
    throw error;
  }

  const { size } = fs.statSync(filePath);
  const removedFiles = pruneExpiredBackups(config);

  backupLogger.info('db_backup.completed', {
    file: fileName,
    sizeBytes: size,
    prunedCount: removedFiles.length,
  });

  return { filePath, removedFiles };
};

// CLI entry point; exported pieces stay importable for tests.
if (require.main === module) {
  runBackup().catch((error) => {
    backupLogger.error('db_backup.failed', { error });
    process.exitCode = 1;
  });
}

module.exports = {
  buildDumpArgs,
  makeBackupFileName,
  isExpiredBackup,
  pruneExpiredBackups,
  runBackup,
  DEFAULT_RETENTION_DAYS,
};
