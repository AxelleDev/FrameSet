-- Columns for the "forgot password" flow: a one-time reset code and its expiry,
-- mirroring the existing email-verification code mechanism.
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `reset_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `reset_code_expires` datetime DEFAULT NULL;
