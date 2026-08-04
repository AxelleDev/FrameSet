-- Harmonizes text collations on utf8mb4_unicode_ci across the schema.
--
-- 001_init created `users` (and later 023 `user_recovery_codes`) as
-- utf8mb4_unicode_ci but the project tables as utf8mb4_general_ci — two
-- different accent/case comparison rules living side by side. Nothing
-- compares text across those tables today, which is exactly why now is the
-- cheap moment to converge: one collation, one sorting behavior, no surprise
-- the day a cross-table comparison or UNION appears.
--
-- Deliberately NOT touched: `revoked_tokens`, whose `token` column is
-- intentionally ascii_bin (lowercase hex digests — see 021); CONVERT TO
-- CHARACTER SET rewrites every text column of a table and would clobber it.
--
-- Same idempotency style as 021: guarded via information_schema, so re-runs
-- (and already-converted databases) are no-ops. CONVERT TO also rebuilds the
-- indexes on the converted columns; these tables are small (per-user content,
-- 50-color palette cap), so the rewrite is instantaneous at this scale.

SET @collation := (
  SELECT TABLE_COLLATION FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects'
);
SET @sql := IF(@collation <> 'utf8mb4_unicode_ci',
  'ALTER TABLE `projects` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @collation := (
  SELECT TABLE_COLLATION FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_brush_norms'
);
SET @sql := IF(@collation <> 'utf8mb4_unicode_ci',
  'ALTER TABLE `project_brush_norms` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @collation := (
  SELECT TABLE_COLLATION FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_typography_norms'
);
SET @sql := IF(@collation <> 'utf8mb4_unicode_ci',
  'ALTER TABLE `project_typography_norms` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @collation := (
  SELECT TABLE_COLLATION FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_palette'
);
SET @sql := IF(@collation <> 'utf8mb4_unicode_ci',
  'ALTER TABLE `project_palette` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
