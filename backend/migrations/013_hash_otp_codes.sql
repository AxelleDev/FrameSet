-- Store one-time codes hashed (SHA-256 hex = 64 chars) instead of the plaintext
-- 6-digit code, and add a per-account failed-attempt counter used to invalidate
-- a code after too many wrong tries.
-- Idempotent: MODIFY is a no-op if already applied; the new column is guarded.

ALTER TABLE `users` MODIFY COLUMN `verification_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL;
ALTER TABLE `users` MODIFY COLUMN `reset_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL;
ALTER TABLE `users` MODIFY COLUMN `pending_email_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'otp_attempts'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `otp_attempts` int NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
