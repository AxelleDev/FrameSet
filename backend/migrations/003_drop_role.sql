-- Drop the legacy users.role column if it still exists.
-- Portable across MySQL and MariaDB, guarded via information_schema.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
);
SET @sql := IF(@exist > 0,
  'ALTER TABLE `users` DROP COLUMN `role`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
