-- ============================================================================
-- Migration 010: Cherry Voice native web widget (Deepgram + Inworld + Gemini)
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS cherry_voice_settings (
  restaurant_id       BIGINT UNSIGNED NOT NULL,
  widget_token        VARCHAR(64)     NOT NULL,
  inworld_voice_id    VARCHAR(64)     NOT NULL DEFAULT 'Sarah',
  agent_id            BIGINT UNSIGNED NULL,
  greeting            TEXT            NULL,
  widget_position     ENUM('bottom-right', 'bottom-left') NOT NULL DEFAULT 'bottom-right',
  accent_color        VARCHAR(7)      NOT NULL DEFAULT '#e11d48',
  is_enabled          TINYINT(1)      NOT NULL DEFAULT 1,
  config              JSON            NULL,
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (restaurant_id),
  UNIQUE KEY uq_cherry_voice_widget_token (widget_token),
  KEY idx_cherry_voice_agent (agent_id),
  CONSTRAINT fk_cherry_voice_settings_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill widget tokens for existing restaurants (idempotent via INSERT IGNORE pattern)
INSERT INTO cherry_voice_settings (restaurant_id, widget_token)
SELECT r.id, CONCAT('cvw_', REPLACE(UUID(), '-', ''))
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1 FROM cherry_voice_settings c WHERE c.restaurant_id = r.id
);

INSERT IGNORE INTO schema_migrations (version) VALUES ('010_cherry_voice_widget');
