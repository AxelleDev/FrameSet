-- Give the color palette a stable surrogate key and explicit ordering.
--
-- Before: project_palette was keyed by (project_id, hex), which forbade two
-- colors with the same hex and stored no order, so the drag-and-drop reordering
-- on the frontend was never persisted.
-- After: an auto-increment `id` identifies each color and a `position` column
-- records the order (read back with ORDER BY position).
--
-- Portable across MySQL and MariaDB and idempotent (guarded via information_schema).

-- 1. Index on project_id first, so the foreign key (fk_project_palette_project)
--    no longer relies on the composite primary key we are about to drop.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_palette' AND INDEX_NAME = 'idx_palette_project'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `project_palette` ADD INDEX `idx_palette_project` (`project_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Swap the composite primary key for a surrogate auto-increment id (only when
--    the id column does not already exist).
SET @hasId := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_palette' AND COLUMN_NAME = 'id'
);
SET @sql := IF(@hasId = 0,
  'ALTER TABLE `project_palette` DROP PRIMARY KEY, ADD COLUMN `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Ordering column.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_palette' AND COLUMN_NAME = 'position'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `project_palette` ADD COLUMN `position` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Seed an initial order from the surrogate ids (insertion order).
UPDATE `project_palette` SET `position` = `id` WHERE `position` = 0;

-- 5. Composite index to read a project's palette in order efficiently.
SET @exist := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_palette' AND INDEX_NAME = 'idx_palette_order'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `project_palette` ADD INDEX `idx_palette_order` (`project_id`, `position`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
