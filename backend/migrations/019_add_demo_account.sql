-- Read-only demo account ("Try without an account"): a dedicated, passwordless
-- user (is_demo = 1) seeded with a copy of a real project, so a visitor sees a
-- populated app instead of an empty one. Writes for this account are rejected
-- server-side in authenticateToken.js — is_demo is never trusted client-side.
ALTER TABLE `users`
  ADD COLUMN `is_demo` tinyint(1) NOT NULL DEFAULT 0;

INSERT INTO `users` (`name`, `email`, `password`, `avatar_initials`, `is_verified`, `is_demo`)
VALUES ('Demo', 'demo@frameset.app', NULL, 'DM', 1, 1);
SET @demo_user_id = LAST_INSERT_ID();

-- Pre-shared so a visitor can see the public share page too, without needing
-- a write to generate the link.
INSERT INTO `projects` (`user_id`, `name`, `share_token`)
VALUES (@demo_user_id, 'Alyse | Twitch Émotes', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
SET @demo_project_id = LAST_INSERT_ID();

INSERT INTO `project_palette` (`project_id`, `name`, `hex`, `position`) VALUES
  (@demo_project_id, 'Eye Reflection', '#A1CFE6', 0),
  (@demo_project_id, 'Hair Shadow', '#A7CCC5', 1),
  (@demo_project_id, 'Eye Base Color', '#558AA3', 2),
  (@demo_project_id, 'Hair Base Color', '#DBE7E5', 3),
  (@demo_project_id, 'Hepatica Anemone Clip Base Color', '#E0E5FC', 4),
  (@demo_project_id, 'Blush Color', '#FCBFC4', 5),
  (@demo_project_id, 'Skin Base Color', '#FFEDE8', 6);

INSERT INTO `project_brush_norms` (`project_id`, `name`, `value`, `unit`, `brush_name`, `opacity`, `position`) VALUES
  (@demo_project_id, 'Hair Lineart', '8', 'px', 'Smooth', 0.22, 0),
  (@demo_project_id, 'Eyes Lineart', '4', 'px', 'Soft Round', 1, 1);

INSERT INTO `project_typography_norms` (`project_id`, `font_family`, `font_weight`, `font_usage`, `position`) VALUES
  (@demo_project_id, 'Parisienne', '500', 'Titres', 0);
