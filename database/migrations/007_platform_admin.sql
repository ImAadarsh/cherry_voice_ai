-- ============================================================================
-- Migration 007: Super Admin platform settings & audit log
-- Platform-level secrets (Omnidim, Gemini) stored in DB; super_admin role
-- ============================================================================

SET NAMES utf8mb4;

-- Platform-wide key/value settings (JSON values; secrets stored plain for now)
CREATE TABLE IF NOT EXISTS platform_settings (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key       VARCHAR(128)    NOT NULL,
  value             JSON            NOT NULL,
  description       VARCHAR(512)    NULL,
  updated_by        BIGINT UNSIGNED NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_platform_settings_key (setting_key),
  KEY idx_platform_settings_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional audit trail for super-admin actions
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id     BIGINT UNSIGNED NULL,
  action            VARCHAR(64)     NOT NULL,
  target_type       VARCHAR(64)     NULL,
  target_id         VARCHAR(64)     NULL,
  metadata          JSON            NULL,
  ip_address        VARCHAR(45)     NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_platform_audit_actor (actor_user_id),
  KEY idx_platform_audit_action (action),
  KEY idx_platform_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unify platform_admin → super_admin (add new enum value first, then migrate data)
ALTER TABLE users
  MODIFY role ENUM('platform_admin','super_admin','owner','admin','manager','staff','viewer')
    NOT NULL DEFAULT 'staff';

UPDATE users SET role = 'super_admin' WHERE role = 'platform_admin';

ALTER TABLE users
  MODIFY role ENUM('super_admin','owner','admin','manager','staff','viewer')
    NOT NULL DEFAULT 'staff';

-- Super Admin account (password documented in .env.example: SUPER_ADMIN_PASSWORD)
-- Default password hash: ChangeMe123!
INSERT INTO users (restaurant_id, name, email, password_hash, role, is_active)
VALUES (1, 'Super Admin', 'superadmin@cherryvoiceai.com',
        '$2b$10$Y9CPBrs5zuygrjDOdjrmjuGQkkZoF9FOBRMt2lzVLWqCCHv/HMVly', 'super_admin', 1)
ON DUPLICATE KEY UPDATE role = VALUES(role), name = VALUES(name);

INSERT INTO schema_migrations (version) VALUES ('007_platform_admin')
  ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
