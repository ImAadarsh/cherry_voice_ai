-- Migration 012: Cherry Voice call logging on unified call_logs table
-- Adds source tracking, structured transcript JSON, and tool call debugging.

ALTER TABLE call_logs
  ADD COLUMN source ENUM('platform', 'cherry_voice') NOT NULL DEFAULT 'platform' AFTER omnidim_call_id,
  ADD COLUMN transcript_json JSON NULL AFTER transcript,
  ADD COLUMN tool_calls JSON NULL AFTER transcript_json;

ALTER TABLE call_logs
  ADD KEY idx_call_logs_source (restaurant_id, source, created_at);
