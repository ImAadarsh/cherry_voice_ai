-- ============================================================================
-- Migration 011: Voice agent types (Cherry Voice native vs platform)
-- ============================================================================

SET NAMES utf8mb4;

ALTER TABLE omnidim_agents
  ADD COLUMN agent_type ENUM('native', 'platform') NOT NULL DEFAULT 'platform'
    AFTER omnidim_agent_id;

INSERT IGNORE INTO schema_migrations (version) VALUES ('011_voice_agent_types');
