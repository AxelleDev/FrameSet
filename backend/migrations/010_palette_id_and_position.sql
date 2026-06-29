-- Give the color palette a stable surrogate key and an explicit ordering column.
--
-- Before: project_palette was keyed by (project_id, hex), which forbade two
-- colors with the same hex in a project and stored no order, so the drag-and-drop
-- reordering on the frontend was never actually persisted.
--
-- After: an auto-increment `id` identifies each color and a `position` column
-- records the order, read back with ORDER BY position.

-- 1. Add an index on project_id first, so the foreign key
--    (fk_project_palette_project) no longer relies on the composite primary key
--    we are about to drop.
ALTER TABLE `project_palette`
  ADD INDEX IF NOT EXISTS `idx_palette_project` (`project_id`);

-- 2. Drop the old composite primary key (project_id, hex).
ALTER TABLE `project_palette`
  DROP PRIMARY KEY;

-- 3. Add the surrogate auto-increment primary key.
ALTER TABLE `project_palette`
  ADD COLUMN IF NOT EXISTS `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;

-- 4. Add the ordering column.
ALTER TABLE `project_palette`
  ADD COLUMN IF NOT EXISTS `position` INT NOT NULL DEFAULT 0;

-- 5. Seed an initial order from the surrogate ids (i.e. insertion order).
UPDATE `project_palette` SET `position` = `id` WHERE `position` = 0;

-- 6. Composite index to read a project's palette in order efficiently.
ALTER TABLE `project_palette`
  ADD INDEX IF NOT EXISTS `idx_palette_order` (`project_id`, `position`);
