-- Performance touches, no behavior change.
--
-- 1. projects (user_id, deleted_at): the dashboard list and its COUNT both
--    filter on `user_id = ? AND deleted_at IS NULL`; the composite index
--    covers that predicate directly instead of post-filtering the user_id
--    scan. The old single-column `user_id` index is kept: the FK relies on a
--    user_id-prefixed index and dropping/re-adding around an FK is riskier
--    than the negligible cost of one redundant small index.
--
-- 2. revoked_tokens.token holds only lowercase hex (SHA-256 digests, see
--    token.service.js), so utf8mb4 storage/collation buys nothing: ascii_bin
--    stores and compares the unique (user_id, token) index bytes ~4x more
--    compactly.
--
-- Portable across MySQL and MariaDB, idempotent (guarded via information_schema).

SET @exist := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND INDEX_NAME = 'idx_projects_user_deleted'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `projects` ADD INDEX `idx_projects_user_deleted` (`user_id`, `deleted_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @charset := (
  SELECT CHARACTER_SET_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'revoked_tokens' AND COLUMN_NAME = 'token'
);
SET @sql := IF(@charset <> 'ascii',
  'ALTER TABLE `revoked_tokens` MODIFY COLUMN `token` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
