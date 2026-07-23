-- Manual ordering for brush/typography standards (drag-and-drop reorder,
-- mirroring the existing `position` column on project_palette) and for
-- pinning projects to the top of the dashboard.
ALTER TABLE `project_brush_norms`
  ADD COLUMN `position` int NOT NULL DEFAULT 0;
ALTER TABLE `project_brush_norms`
  ADD INDEX `idx_brush_norms_project_position` (`project_id`, `position`);

ALTER TABLE `project_typography_norms`
  ADD COLUMN `position` int NOT NULL DEFAULT 0;
ALTER TABLE `project_typography_norms`
  ADD INDEX `idx_typography_norms_project_position` (`project_id`, `position`);

-- pin_position: NULL means "not pinned"; otherwise the project's manual rank
-- among the user's pinned projects (lower sorts first). Pinned projects are
-- always listed before unpinned ones, regardless of pin_position.
ALTER TABLE `projects`
  ADD COLUMN `pin_position` int DEFAULT NULL;
ALTER TABLE `projects`
  ADD INDEX `idx_projects_user_pin_position` (`user_id`, `pin_position`);
