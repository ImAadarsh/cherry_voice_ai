-- ============================================================================
-- Migration 008: Landing page contact / inquiry submissions
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name              VARCHAR(180)    NOT NULL,
  email             VARCHAR(190)    NOT NULL,
  phone             VARCHAR(32)     NULL,
  business_name     VARCHAR(255)    NULL,
  interest          ENUM('restaurant','salon','healthcare','other') NOT NULL,
  message           TEXT            NOT NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contact_inquiries_email (email),
  KEY idx_contact_inquiries_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version) VALUES ('008_contact_inquiries');

