-- Add users.password_updated_at if missing.
-- Portable across MySQL and MariaDB (MySQL has no ADD COLUMN IF NOT EXISTS),
-- guarded via information_schema so the migration stays idempotent.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_updated_at'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `password_updated_at` datetime DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
