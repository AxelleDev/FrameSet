-- Add the "forgot password" columns (one-time reset code + expiry) if missing,
-- mirroring the email-verification mechanism.
-- Portable across MySQL and MariaDB and idempotent (guarded via information_schema).

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_code'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `reset_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_code_expires'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `reset_code_expires` datetime DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
