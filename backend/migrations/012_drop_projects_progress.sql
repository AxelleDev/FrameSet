-- Drop the unused projects.progress column (it was written as 0 on creation but
-- never read anywhere). Portable across MySQL and MariaDB; guarded for idempotency.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'progress'
);
SET @sql := IF(@exist > 0,
  'ALTER TABLE `projects` DROP COLUMN `progress`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
