-- Public read-only share links: a project with a share_token is viewable (name,
-- norms, palette only) by anyone holding the link at /s/<token>. NULL = sharing
-- disabled. The token is 32 hex chars (128 random bits), unguessable by design.
ALTER TABLE `projects`
  ADD COLUMN `share_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD UNIQUE KEY `uniq_share_token` (`share_token`);
