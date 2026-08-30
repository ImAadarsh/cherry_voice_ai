-- Migration 014: Cherry Voice P2 — settings flags, combo categories, branch stub
-- Idempotent: safe if columns were partially applied on a prior deploy.

SET @db = DATABASE();

SET @has_earcon := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cherry_voice_settings' AND COLUMN_NAME = 'processing_earcon_enabled'
);
SET @sql_earcon := IF(
  @has_earcon = 0,
  'ALTER TABLE cherry_voice_settings ADD COLUMN processing_earcon_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER is_enabled',
  'SELECT 1'
);
PREPARE stmt_earcon FROM @sql_earcon;
EXECUTE stmt_earcon;
DEALLOCATE PREPARE stmt_earcon;

SET @has_sms := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cherry_voice_settings' AND COLUMN_NAME = 'post_call_sms_enabled'
);
SET @sql_sms := IF(
  @has_sms = 0,
  'ALTER TABLE cherry_voice_settings ADD COLUMN post_call_sms_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER processing_earcon_enabled',
  'SELECT 1'
);
PREPARE stmt_sms FROM @sql_sms;
EXECUTE stmt_sms;
DEALLOCATE PREPARE stmt_sms;

SET @has_branch := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cherry_voice_settings' AND COLUMN_NAME = 'branch_id'
);
SET @sql_branch := IF(
  @has_branch = 0,
  'ALTER TABLE cherry_voice_settings ADD COLUMN branch_id BIGINT UNSIGNED NULL AFTER post_call_sms_enabled',
  'SELECT 1'
);
PREPARE stmt_branch FROM @sql_branch;
EXECUTE stmt_branch;
DEALLOCATE PREPARE stmt_branch;

SET @has_combo := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'menu_categories' AND COLUMN_NAME = 'is_combo'
);
SET @sql_combo := IF(
  @has_combo = 0,
  'ALTER TABLE menu_categories ADD COLUMN is_combo TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active',
  'SELECT 1'
);
PREPARE stmt_combo FROM @sql_combo;
EXECUTE stmt_combo;
DEALLOCATE PREPARE stmt_combo;

INSERT INTO schema_migrations (version) VALUES ('014_cherry_voice_p2')
  ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
