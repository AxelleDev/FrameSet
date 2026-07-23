-- Project trash (soft delete): deleting a project now stamps deleted_at instead
-- of dropping the row, so it can be restored for 30 days before the scheduled
-- purge removes it (and its norms/palette via the cascading foreign keys).
ALTER TABLE `projects`
  ADD COLUMN `deleted_at` datetime DEFAULT NULL;

-- The dashboard always filters on (user_id, deleted_at); the purge scans deleted_at.
ALTER TABLE `projects`
  ADD INDEX `idx_projects_user_deleted` (`user_id`, `deleted_at`);
