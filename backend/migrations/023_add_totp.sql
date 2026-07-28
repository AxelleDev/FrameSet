-- Optional TOTP two-factor authentication: an encrypted secret (AES-256-GCM,
-- see backend/src/utils/encryption.js — TOTP secrets must be recoverable to
-- compute the current code, so unlike passwords/OTP codes they cannot be
-- one-way hashed), a pending secret held during setup until the user proves
-- they scanned it correctly, and an enabled flag. Recovery codes live in
-- their own table (one row per single-use code, hashed like OTP codes).
--
-- Idempotent (guarded via information_schema) and portable across MySQL/MariaDB.

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'totp_secret_encrypted'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `totp_secret_encrypted` text COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'totp_pending_secret_encrypted'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `totp_pending_secret_encrypted` text COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'totp_enabled'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `totp_enabled` tinyint(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Highest TOTP time-step counter already accepted for this user: a code is
-- only valid for a step strictly greater, so an intercepted code can never be
-- replayed inside its 30s window (RFC 6238 §5.2).
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'totp_last_used_step'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ADD COLUMN `totp_last_used_step` bigint DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `user_recovery_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `code_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `fk_recovery_codes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
