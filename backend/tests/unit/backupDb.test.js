const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildDumpArgs,
  makeBackupFileName,
  isExpiredBackup,
  pruneExpiredBackups,
  DEFAULT_RETENTION_DAYS,
} = require('../../scripts/backup-db');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('database backup script', () => {
  describe('buildDumpArgs', () => {
    it('produces a consistent, lock-free dump command without the password', () => {
      const args = buildDumpArgs({
        host: 'db.example',
        port: 3307,
        user: 'frameset',
        password: 'super-secret',
        database: 'frameset_db',
      });

      expect(args).toEqual([
        '--host=db.example',
        '--port=3307',
        '--user=frameset',
        '--single-transaction',
        '--routines',
        '--triggers',
        'frameset_db',
      ]);
      // The password must ride in MYSQL_PWD, never on the command line where
      // any local process listing could read it.
      expect(args.join(' ')).not.toContain('super-secret');
    });
  });

  describe('makeBackupFileName', () => {
    it('names backups <database>-<UTC timestamp>.sql.gz with filesystem-safe characters', () => {
      const fileName = makeBackupFileName('frameset_db', new Date('2026-07-24T10:30:05.123Z'));
      expect(fileName).toBe('frameset_db-2026-07-24T10-30-05Z.sql.gz');
    });
  });

  describe('isExpiredBackup', () => {
    it('keeps files within the retention window and expires the rest', () => {
      const now = Date.now();
      expect(isExpiredBackup(now - 13 * DAY_MS, now, DEFAULT_RETENTION_DAYS)).toBe(false);
      expect(isExpiredBackup(now - 15 * DAY_MS, now, DEFAULT_RETENTION_DAYS)).toBe(true);
    });
  });

  describe('pruneExpiredBackups', () => {
    let backupDir;

    beforeEach(() => {
      backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frameset-backup-test-'));
    });

    afterEach(() => {
      fs.rmSync(backupDir, { recursive: true, force: true });
    });

    const touch = (fileName, ageDays, nowMs) => {
      const filePath = path.join(backupDir, fileName);
      fs.writeFileSync(filePath, 'dump');
      const mtime = new Date(nowMs - ageDays * DAY_MS);
      fs.utimesSync(filePath, mtime, mtime);
    };

    it("removes only this database's expired backups and leaves everything else alone", () => {
      const nowMs = Date.now();
      touch('frameset_db-2026-07-01T00-00-00Z.sql.gz', 20, nowMs); // expired
      touch('frameset_db-2026-07-23T00-00-00Z.sql.gz', 1, nowMs); // fresh
      touch('other_db-2026-07-01T00-00-00Z.sql.gz', 20, nowMs); // other database
      touch('notes.txt', 20, nowMs); // unrelated file

      const removed = pruneExpiredBackups(
        { database: 'frameset_db', backupDir, retentionDays: 14 },
        nowMs,
      );

      expect(removed).toEqual(['frameset_db-2026-07-01T00-00-00Z.sql.gz']);
      expect(fs.readdirSync(backupDir).sort()).toEqual([
        'frameset_db-2026-07-23T00-00-00Z.sql.gz',
        'notes.txt',
        'other_db-2026-07-01T00-00-00Z.sql.gz',
      ]);
    });
  });
});
