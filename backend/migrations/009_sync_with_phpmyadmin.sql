-- Ensure the project tables use InnoDB and add the brush opacity column.
-- The foreign keys are already created by 001_init.sql, so they are NOT
-- re-added here (re-adding them fails on a database built from the migrations).
-- Portable across MySQL and MariaDB; the opacity add is guarded for idempotency.
ALTER TABLE `project_brush_norms` ENGINE=InnoDB;
ALTER TABLE `project_palette` ENGINE=InnoDB;
ALTER TABLE `project_typography_norms` ENGINE=InnoDB;

SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_brush_norms' AND COLUMN_NAME = 'opacity'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `project_brush_norms` ADD COLUMN `opacity` FLOAT NULL AFTER `unit`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
