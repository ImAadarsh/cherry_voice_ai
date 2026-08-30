-- Migration 003: Onboarding assets + restaurant agent context
-- Scoped by restaurant_id for multi-tenant isolation.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS onboarding_assets (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  asset_type        ENUM('menu_image','menu_pdf','website_snapshot') NOT NULL,
  original_filename VARCHAR(255)    NOT NULL,
  stored_path       VARCHAR(512)    NOT NULL,
  mime_type         VARCHAR(120)    NULL,
  file_size         INT UNSIGNED    NULL,
  extraction_status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  extraction_provider ENUM('omnidim','gemini','manual') NULL,
  omnidim_file_id   INT UNSIGNED    NULL,
  extracted_data    JSON            NULL,
  error_message     VARCHAR(512)    NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_onboarding_assets_restaurant (restaurant_id),
  KEY idx_onboarding_assets_status (restaurant_id, extraction_status),
  CONSTRAINT fk_onboarding_assets_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurant_agent_context (
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  menu_summary      TEXT            NULL,
  policies          TEXT            NULL,
  hours             TEXT            NULL,
  delivery_zones    TEXT            NULL,
  cuisine_type      VARCHAR(120)    NULL,
  website_url       VARCHAR(512)    NULL,
  raw_context       JSON            NULL,
  generated_prompt  LONGTEXT        NULL,
  extraction_status ENUM('idle','uploading','extracting','ready','failed') NOT NULL DEFAULT 'idle',
  last_extracted_at TIMESTAMP       NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (restaurant_id),
  CONSTRAINT fk_restaurant_agent_context_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO schema_migrations (version) VALUES ('003_onboarding_context')
  ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
