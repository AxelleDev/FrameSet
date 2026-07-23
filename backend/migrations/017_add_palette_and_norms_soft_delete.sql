-- Extends the trash (soft delete) pattern from projects down to their
-- individual colors and standards: deleting a color, brush norm or typography
-- norm now stamps deleted_at instead of dropping the row, so each is
-- restorable for 30 days before the scheduled purge removes it.
ALTER TABLE `project_palette`
  ADD COLUMN `deleted_at` datetime DEFAULT NULL;
ALTER TABLE `project_palette`
  ADD INDEX `idx_palette_project_deleted` (`project_id`, `deleted_at`);

ALTER TABLE `project_brush_norms`
  ADD COLUMN `deleted_at` datetime DEFAULT NULL;
ALTER TABLE `project_brush_norms`
  ADD INDEX `idx_brush_norms_project_deleted` (`project_id`, `deleted_at`);

ALTER TABLE `project_typography_norms`
  ADD COLUMN `deleted_at` datetime DEFAULT NULL;
ALTER TABLE `project_typography_norms`
  ADD INDEX `idx_typography_norms_project_deleted` (`project_id`, `deleted_at`);
