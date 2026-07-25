/**
 * Backup script execution paths (mysqldump mocked): a successful run writes the
 * final .sql.gz and leaves no .partial behind; a failed run (non-zero exit or
 * unspawnable binary) rejects and cleans up its partial file, so an interrupted
 * run can never be mistaken for a valid backup. Complements backupDb.test.js,
 * which covers the pure helpers.
 */

jest.mock('child_process', () => ({ spawn: jest.fn() }));

const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { runBackup } = require('../../scripts/backup-db');

// A fake mysqldump child process: streams `stdoutData`, then exits with
// `exitCode` (or emits `spawnError` instead of ever producing output).
const makeFakeDump = ({
  exitCode = 0,
  stdoutData = 'SQL DUMP',
  stderrData = '',
  spawnError,
} = {}) => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();

  setImmediate(() => {
    if (spawnError) {
      child.stderr.end();
      child.stdout.end();
      child.emit('error', spawnError);
      return;
    }
    if (stderrData) child.stderr.write(stderrData);
    child.stderr.end();
    child.stdout.end(stdoutData);
    // Real children close only after their streams flush.
    setImmediate(() => child.emit('close', exitCode));
  });

  return child;
};

describe('runBackup', () => {
  let backupDir;

  beforeEach(() => {
    jest.clearAllMocks();
    backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frameset-backup-run-'));
    process.env.BACKUP_DIR = backupDir;
  });

  afterEach(() => {
    delete process.env.BACKUP_DIR;
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  it('writes the gzipped dump and leaves no .partial file on success', async () => {
    spawn.mockReturnValueOnce(makeFakeDump({ exitCode: 0, stdoutData: 'CREATE TABLE ...' }));

    const { filePath } = await runBackup();

    expect(fs.existsSync(filePath)).toBe(true);
    expect(filePath.endsWith('.sql.gz')).toBe(true);
    const leftovers = fs.readdirSync(backupDir).filter((name) => name.endsWith('.partial'));
    expect(leftovers).toEqual([]);
    // The password rides in the child's MYSQL_PWD env, never in the arguments.
    const [, args, options] = spawn.mock.calls[0];
    expect(options.env).toHaveProperty('MYSQL_PWD');
    expect(args.join(' ')).not.toContain('MYSQL_PWD');
  });

  it('rejects with the mysqldump stderr and removes the partial file on a non-zero exit', async () => {
    spawn.mockReturnValueOnce(
      makeFakeDump({ exitCode: 2, stdoutData: 'half a dump', stderrData: 'Access denied' }),
    );

    await expect(runBackup()).rejects.toThrow(/exited with code 2.*Access denied/s);
    expect(fs.readdirSync(backupDir)).toEqual([]); // nothing that looks like a backup
  });

  it('rejects cleanly when the mysqldump binary cannot be started', async () => {
    spawn.mockReturnValueOnce(makeFakeDump({ spawnError: new Error('spawn mysqldump ENOENT') }));

    await expect(runBackup()).rejects.toThrow(/Failed to start mysqldump/);
    expect(fs.readdirSync(backupDir)).toEqual([]);
  });
});
