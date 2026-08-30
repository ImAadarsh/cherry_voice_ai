-- Migration 013: Cherry Voice P1 — turn metrics, menu aliases, personality preset support
-- Idempotent: safe if columns were partially applied on a prior deploy.

SET @db = DATABASE();

SET @has_turn_metrics := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'call_logs' AND COLUMN_NAME = 'turn_metrics'
);
SET @sql_turn_metrics := IF(
  @has_turn_metrics = 0,
  'ALTER TABLE call_logs ADD COLUMN turn_metrics JSON NULL AFTER tool_calls',
  'SELECT 1'
);
PREPARE stmt_turn_metrics FROM @sql_turn_metrics;
EXECUTE stmt_turn_metrics;
DEALLOCATE PREPARE stmt_turn_metrics;

INSERT INTO schema_migrations (version) VALUES ('013_cherry_voice_p1')
  ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
