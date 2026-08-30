-- Migration 012: Cherry Voice call logging on unified call_logs table
-- Adds source tracking, structured transcript JSON, and tool call debugging.
-- Idempotent: safe if columns/index were partially applied on a prior deploy.

SET @db = DATABASE();

SET @has_source := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'call_logs' AND COLUMN_NAME = 'source'
);
SET @sql_source := IF(
  @has_source = 0,
  'ALTER TABLE call_logs ADD COLUMN source ENUM(''platform'', ''cherry_voice'') NOT NULL DEFAULT ''platform'' AFTER omnidim_call_id',
  'SELECT 1'
);
PREPARE stmt_source FROM @sql_source;
EXECUTE stmt_source;
DEALLOCATE PREPARE stmt_source;

SET @has_transcript_json := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'call_logs' AND COLUMN_NAME = 'transcript_json'
);
SET @sql_transcript_json := IF(
  @has_transcript_json = 0,
  'ALTER TABLE call_logs ADD COLUMN transcript_json JSON NULL AFTER transcript',
  'SELECT 1'
);
PREPARE stmt_transcript_json FROM @sql_transcript_json;
EXECUTE stmt_transcript_json;
DEALLOCATE PREPARE stmt_transcript_json;

SET @has_tool_calls := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'call_logs' AND COLUMN_NAME = 'tool_calls'
);
SET @sql_tool_calls := IF(
  @has_tool_calls = 0,
  'ALTER TABLE call_logs ADD COLUMN tool_calls JSON NULL AFTER transcript_json',
  'SELECT 1'
);
PREPARE stmt_tool_calls FROM @sql_tool_calls;
EXECUTE stmt_tool_calls;
DEALLOCATE PREPARE stmt_tool_calls;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'call_logs' AND INDEX_NAME = 'idx_call_logs_source'
);
SET @sql_idx := IF(
  @has_idx = 0,
  'ALTER TABLE call_logs ADD KEY idx_call_logs_source (restaurant_id, source, created_at)',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;
