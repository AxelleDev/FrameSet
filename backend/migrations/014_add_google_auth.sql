-- Google sign-in support: accounts created via Google have no local password
-- (NULL), and google_id stores Google's stable subject identifier ("sub") so
-- sign-in survives a Google-side or FrameSet-side email change.
ALTER TABLE `users`
  MODIFY COLUMN `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

ALTER TABLE `users`
  ADD COLUMN `google_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD UNIQUE KEY `uniq_google_id` (`google_id`);
