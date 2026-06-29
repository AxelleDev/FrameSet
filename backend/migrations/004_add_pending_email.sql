-- Add the pending-email-change columns if missing.
-- Portable across MySQL and MariaDB, each column guarded via information_schema.

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'pending_email'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `pending_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'pending_email_code'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `pending_email_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'pending_email_expires'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `pending_email_expires` datetime DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
