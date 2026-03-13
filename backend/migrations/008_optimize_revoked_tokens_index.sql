ALTER TABLE `revoked_tokens`
  MODIFY COLUMN `token` CHAR(64) COLLATE utf8mb4_general_ci NOT NULL;

ALTER TABLE `revoked_tokens`
  DROP INDEX `user_id`,
  ADD UNIQUE INDEX `uniq_user_token` (`user_id`, `token`);
