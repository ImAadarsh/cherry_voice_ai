-- Migration 005: Agent conversation flows
CREATE TABLE IF NOT EXISTS agent_flows (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  name              VARCHAR(180)    NOT NULL,
  template          ENUM('restaurant_order','reservation','combined','custom') NOT NULL DEFAULT 'custom',
  steps             JSON            NOT NULL,
  generated_prompt  TEXT            NULL,
  is_active         TINYINT(1)      NOT NULL DEFAULT 1,
  applied_agent_id  VARCHAR(64)     NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agent_flows_restaurant (restaurant_id),
  CONSTRAINT fk_agent_flows_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version) VALUES ('005_agent_flows');

