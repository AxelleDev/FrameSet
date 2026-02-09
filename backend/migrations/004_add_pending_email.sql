ALTER TABLE `users`
  ADD COLUMN `pending_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN `pending_email_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN `pending_email_expires` datetime DEFAULT NULL;
