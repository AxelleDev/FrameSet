-- Widens uniq_email from a 191-char prefix to the full `email` column.
--
-- Before: uniq_email covered only the first 191 characters of `email`
-- (varchar(255)) — the classic workaround for MySQL's old 767-byte InnoDB
-- index-key limit with utf8mb4 (191 * 4 bytes ~= 764 <= 767). Two addresses
-- differing only after character 191 could then collide as "the same" email
-- for uniqueness purposes — purely theoretical (RFC 5321 caps an address at
-- 254 characters and nobody is anywhere near 191), but incorrect on paper.
-- After: DYNAMIC row format supports index keys up to 3072 bytes, comfortably
-- covering the full 255-char utf8mb4 column (255 * 4 = 1020 bytes), so the
-- prefix limit is no longer needed.
--
-- Idempotent (guarded via information_schema) and portable across MySQL/MariaDB.

SET @exist := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uniq_email'
    AND SUB_PART IS NULL
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `users` ROW_FORMAT=DYNAMIC, DROP INDEX `uniq_email`, ADD UNIQUE KEY `uniq_email` (`email`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
