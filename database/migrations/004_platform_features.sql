-- ============================================================================
-- Migration 004: Platform value-add features
-- CRM fields, loyalty, reservations, message logs, platform_admin role
-- ============================================================================

SET NAMES utf8mb4;

-- CRM + loyalty on customers
ALTER TABLE customers
  ADD COLUMN preferences TEXT NULL AFTER notes,
  ADD COLUMN allergies JSON NULL AFTER preferences,
  ADD COLUMN loyalty_points INT UNSIGNED NOT NULL DEFAULT 0 AFTER total_spent;

-- Platform super-admin role
ALTER TABLE users
  MODIFY role ENUM('platform_admin','owner','admin','manager','staff','viewer')
    NOT NULL DEFAULT 'staff';

-- Table reservations
CREATE TABLE IF NOT EXISTS reservations (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  customer_id       BIGINT UNSIGNED NULL,
  customer_name     VARCHAR(180)    NOT NULL,
  customer_phone    VARCHAR(32)     NOT NULL,
  party_size        TINYINT UNSIGNED NOT NULL DEFAULT 2,
  reserved_at       TIMESTAMP       NOT NULL,
  status            ENUM('pending','confirmed','seated','completed','cancelled','no_show')
                      NOT NULL DEFAULT 'pending',
  notes             TEXT            NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservations_restaurant (restaurant_id),
  KEY idx_reservations_date (restaurant_id, reserved_at),
  KEY idx_reservations_status (restaurant_id, status),
  CONSTRAINT fk_reservations_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reservations_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Outbound SMS / WhatsApp / email delivery log
CREATE TABLE IF NOT EXISTS message_logs (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NULL,
  order_id          BIGINT UNSIGNED NULL,
  customer_id       BIGINT UNSIGNED NULL,
  channel           ENUM('sms','whatsapp','email') NOT NULL,
  destination       VARCHAR(190)    NOT NULL,
  body              TEXT            NULL,
  provider          VARCHAR(64)     NOT NULL DEFAULT 'stub',
  status            ENUM('sent','failed','simulated','skipped') NOT NULL DEFAULT 'simulated',
  provider_ref      VARCHAR(128)    NULL,
  error_message     VARCHAR(512)    NULL,
  metadata          JSON            NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_message_logs_restaurant (restaurant_id),
  KEY idx_message_logs_order (order_id),
  KEY idx_message_logs_created (created_at),
  CONSTRAINT fk_message_logs_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_message_logs_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Staff notification defaults
INSERT INTO settings (restaurant_id, category, `key`, value, description) VALUES
  (1, 'notifications', 'new_order_webhook', '""', 'Webhook URL for new order alerts'),
  (1, 'notifications', 'new_order_email', '"owner@cherrybistro.test"', 'Email for new order alerts'),
  (1, 'notifications', 'new_order_enabled', 'true', 'Send staff alerts on new orders'),
  (1, 'loyalty', 'points_per_dollar', '1', 'Loyalty points earned per major currency unit on paid orders')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- Demo platform admin (password same as owner: ChangeMe123!)
INSERT INTO users (restaurant_id, name, email, password_hash, role, is_active)
VALUES (1, 'Platform Admin', 'admin@cherryvoice.test',
        '$2b$10$Y9CPBrs5zuygrjDOdjrmjuGQkkZoF9FOBRMt2lzVLWqCCHv/HMVly', 'platform_admin', 1)
ON DUPLICATE KEY UPDATE role = VALUES(role);

INSERT INTO schema_migrations (version) VALUES ('004_platform_features')
  ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
