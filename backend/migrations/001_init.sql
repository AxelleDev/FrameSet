CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_initials` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pending_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pending_email_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pending_email_expires` datetime DEFAULT NULL,
  `is_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verification_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verification_code_expires` datetime DEFAULT NULL,
  `password_updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `client` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `progress` int NOT NULL DEFAULT '0',
  `last_edited` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `fk_projects_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `project_brush_norms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `value` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `unit` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `brush_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `fk_project_brush_norms_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `project_palette` (
  `project_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `hex` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`project_id`,`hex`),
  CONSTRAINT `fk_project_palette_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `project_typography_norms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `font_family` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `font_weight` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `font_usage` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `font_style` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `fk_project_typography_norms_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
