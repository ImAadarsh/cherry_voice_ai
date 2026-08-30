-- ============================================================================
-- Migration 006: Per-restaurant API keys for Omnidim custom API integrations
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS restaurant_integration_keys (
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  api_key           VARCHAR(64)     NOT NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (restaurant_id),
  UNIQUE KEY uq_restaurant_integration_keys_api_key (api_key),
  CONSTRAINT fk_restaurant_integration_keys_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS omnidim_agent_integrations (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id           BIGINT UNSIGNED NOT NULL,
  omnidim_agent_id        VARCHAR(64)     NOT NULL,
  omnidim_integration_id  INT UNSIGNED    NOT NULL,
  tool_name               VARCHAR(64)     NOT NULL,
  created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_omnidim_agent_tool (omnidim_agent_id, tool_name),
  KEY idx_omnidim_agent_integrations_restaurant (restaurant_id),
  CONSTRAINT fk_omnidim_agent_integrations_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version) VALUES ('006_restaurant_integration_keys');

