UPDATE `projects`
SET `last_edited` = CURRENT_TIMESTAMP
WHERE `last_edited` IS NULL;

SET @has_client_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'client'
);

SET @drop_client_sql := IF(
  @has_client_column > 0,
  'ALTER TABLE `projects` DROP COLUMN `client`',
  'SELECT 1'
);

PREPARE drop_client_stmt FROM @drop_client_sql;
EXECUTE drop_client_stmt;
DEALLOCATE PREPARE drop_client_stmt;

ALTER TABLE `projects`
  MODIFY COLUMN `last_edited` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE `projects` ENGINE=InnoDB;
