-- ============================================================================
-- Cherry Voice AI — Restaurant Calling Agent System
-- Migration 001: Initial schema
-- Engine: InnoDB | Charset: utf8mb4 | Target: MySQL 8 / MariaDB 10.5+
--
-- Design notes:
--   * Multi-tenant: every domain table is scoped by `restaurant_id`.
--   * Money is stored in the smallest currency unit (integer, e.g. cents/paise)
--     to avoid floating-point rounding errors. `currency` is ISO-4217.
--   * External identifiers (Omnidim agent/call ids, gateway ids) are stored as
--     VARCHAR so we never depend on a provider's numeric format.
--   * Idempotency: webhook + payment tables carry unique external ids so retries
--     from Omnidim / Stripe / Razorpay do not create duplicates.
--   * ON DELETE: child rows that are meaningless without a parent cascade;
--     historical/audit rows (call_logs, webhooks_log, payments) use SET NULL /
--     RESTRICT so financial + call history is never silently destroyed.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- restaurants  (tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name              VARCHAR(180)    NOT NULL,
  slug              VARCHAR(180)    NOT NULL,
  legal_name        VARCHAR(255)    NULL,
  email             VARCHAR(190)    NULL,
  phone             VARCHAR(32)     NULL,
  timezone          VARCHAR(64)     NOT NULL DEFAULT 'UTC',
  currency          CHAR(3)         NOT NULL DEFAULT 'USD',
  address_line1     VARCHAR(255)    NULL,
  address_line2     VARCHAR(255)    NULL,
  city              VARCHAR(120)    NULL,
  state             VARCHAR(120)    NULL,
  postal_code       VARCHAR(20)     NULL,
  country           CHAR(2)         NULL,
  logo_url          VARCHAR(512)    NULL,
  status            ENUM('active','suspended','trial','closed') NOT NULL DEFAULT 'trial',
  metadata          JSON            NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_restaurants_slug (slug),
  KEY idx_restaurants_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- users  (dashboard admins / staff for a restaurant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  name              VARCHAR(180)    NOT NULL,
  email             VARCHAR(190)    NOT NULL,
  password_hash     VARCHAR(255)    NULL,          -- bcrypt/argon2; NULL for SSO-only
  role              ENUM('owner','admin','manager','staff','viewer') NOT NULL DEFAULT 'staff',
  phone             VARCHAR(32)     NULL,
  avatar_url        VARCHAR(512)    NULL,
  is_active         TINYINT(1)      NOT NULL DEFAULT 1,
  last_login_at     TIMESTAMP       NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_restaurant_email (restaurant_id, email),
  KEY idx_users_restaurant (restaurant_id),
  KEY idx_users_role (role),
  CONSTRAINT fk_users_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- sessions  (server session/token store for dashboard auth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id                CHAR(36)        NOT NULL,       -- UUID
  user_id           BIGINT UNSIGNED NOT NULL,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  ip_address        VARCHAR(45)     NULL,
  user_agent        VARCHAR(255)    NULL,
  expires_at        TIMESTAMP       NOT NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sessions_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- customers  (phone-first: created/looked up by the voice agent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  name              VARCHAR(180)    NULL,
  phone             VARCHAR(32)     NOT NULL,       -- E.164, primary identifier for calls
  email             VARCHAR(190)    NULL,
  default_address   VARCHAR(512)    NULL,
  notes             TEXT            NULL,
  tags              JSON            NULL,
  total_orders      INT UNSIGNED    NOT NULL DEFAULT 0,
  total_spent       BIGINT UNSIGNED NOT NULL DEFAULT 0,  -- minor units, denormalised
  last_order_at     TIMESTAMP       NULL,
  marketing_opt_in  TINYINT(1)      NOT NULL DEFAULT 0,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_restaurant_phone (restaurant_id, phone),
  KEY idx_customers_restaurant (restaurant_id),
  KEY idx_customers_email (email),
  CONSTRAINT fk_customers_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- menu_categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_categories (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  name              VARCHAR(150)    NOT NULL,
  description       VARCHAR(512)    NULL,
  sort_order        INT             NOT NULL DEFAULT 0,
  is_active         TINYINT(1)      NOT NULL DEFAULT 1,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_categories_restaurant (restaurant_id),
  KEY idx_categories_active (restaurant_id, is_active),
  CONSTRAINT fk_categories_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- menu_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  category_id       BIGINT UNSIGNED NULL,
  sku               VARCHAR(64)     NULL,           -- optional internal code the agent can reference
  name              VARCHAR(180)    NOT NULL,
  description       TEXT            NULL,
  price             BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- minor units
  currency          CHAR(3)         NOT NULL DEFAULT 'USD',
  image_url         VARCHAR(512)    NULL,
  is_available      TINYINT(1)      NOT NULL DEFAULT 1,
  is_vegetarian     TINYINT(1)      NOT NULL DEFAULT 0,
  spice_level       TINYINT UNSIGNED NULL,          -- 0-5, optional
  prep_time_minutes SMALLINT UNSIGNED NULL,
  options           JSON            NULL,           -- modifiers/variants: sizes, add-ons
  allergens         JSON            NULL,
  sort_order        INT             NOT NULL DEFAULT 0,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_items_restaurant_sku (restaurant_id, sku),
  KEY idx_menu_items_restaurant (restaurant_id),
  KEY idx_menu_items_category (category_id),
  KEY idx_menu_items_available (restaurant_id, is_available),
  CONSTRAINT fk_menu_items_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id)
    REFERENCES menu_categories (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- omnidim_agents  (maps a restaurant to an Omnidim voice agent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS omnidim_agents (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  omnidim_agent_id  VARCHAR(64)     NOT NULL,       -- id from Omnidim (agents.list -> id)
  name              VARCHAR(180)    NOT NULL,
  phone_number      VARCHAR(32)     NULL,           -- number attached to this agent
  direction         ENUM('inbound','outbound','both') NOT NULL DEFAULT 'inbound',
  language          VARCHAR(16)     NULL,
  voice_id          VARCHAR(64)     NULL,
  is_active         TINYINT(1)      NOT NULL DEFAULT 1,
  config            JSON            NULL,           -- cached agent config / prompt snapshot
  last_synced_at    TIMESTAMP       NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_omnidim_agent (omnidim_agent_id),
  KEY idx_omnidim_agents_restaurant (restaurant_id),
  CONSTRAINT fk_omnidim_agents_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- call_logs  (one row per voice call handled by an agent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  agent_id          BIGINT UNSIGNED NULL,           -- FK to omnidim_agents
  customer_id       BIGINT UNSIGNED NULL,
  omnidim_call_id   VARCHAR(64)     NULL,           -- id from Omnidim call logs
  direction         ENUM('inbound','outbound') NOT NULL DEFAULT 'inbound',
  from_number       VARCHAR(32)     NULL,
  to_number         VARCHAR(32)     NULL,
  status            ENUM('initiated','ringing','in_progress','completed','failed','no_answer','busy','canceled')
                      NOT NULL DEFAULT 'initiated',
  started_at        TIMESTAMP       NULL,
  ended_at          TIMESTAMP       NULL,
  duration_seconds  INT UNSIGNED    NULL,
  recording_url     VARCHAR(512)    NULL,
  transcript        LONGTEXT        NULL,
  summary           TEXT            NULL,
  sentiment         VARCHAR(32)     NULL,
  raw_payload       JSON            NULL,           -- full provider payload for debugging
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_call_logs_omnidim_call (omnidim_call_id),
  KEY idx_call_logs_restaurant (restaurant_id),
  KEY idx_call_logs_agent (agent_id),
  KEY idx_call_logs_customer (customer_id),
  KEY idx_call_logs_status (status),
  KEY idx_call_logs_started (started_at),
  CONSTRAINT fk_call_logs_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_call_logs_agent FOREIGN KEY (agent_id)
    REFERENCES omnidim_agents (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_call_logs_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  customer_id       BIGINT UNSIGNED NULL,
  call_log_id       BIGINT UNSIGNED NULL,           -- the call that produced this order
  agent_id          BIGINT UNSIGNED NULL,
  order_number      VARCHAR(32)     NOT NULL,       -- human-friendly, unique per restaurant
  channel           ENUM('voice','web','pos','manual') NOT NULL DEFAULT 'voice',
  order_type        ENUM('delivery','pickup','dine_in') NOT NULL DEFAULT 'pickup',
  status            ENUM('draft','pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled','refunded')
                      NOT NULL DEFAULT 'pending',
  payment_status    ENUM('unpaid','link_sent','processing','paid','failed','refunded','partially_refunded')
                      NOT NULL DEFAULT 'unpaid',
  currency          CHAR(3)         NOT NULL DEFAULT 'USD',
  subtotal          BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- minor units
  tax_amount        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  delivery_fee      BIGINT UNSIGNED NOT NULL DEFAULT 0,
  discount_amount   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tip_amount        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_amount      BIGINT UNSIGNED NOT NULL DEFAULT 0,
  customer_name     VARCHAR(180)    NULL,           -- snapshot at order time
  customer_phone    VARCHAR(32)     NULL,
  delivery_address  VARCHAR(512)    NULL,
  scheduled_for     TIMESTAMP       NULL,           -- for pre-orders
  notes             TEXT            NULL,           -- special instructions from the call
  metadata          JSON            NULL,
  placed_at         TIMESTAMP       NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_restaurant_number (restaurant_id, order_number),
  KEY idx_orders_restaurant (restaurant_id),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_call (call_log_id),
  KEY idx_orders_status (restaurant_id, status),
  KEY idx_orders_payment_status (restaurant_id, payment_status),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_call FOREIGN KEY (call_log_id)
    REFERENCES call_logs (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_agent FOREIGN KEY (agent_id)
    REFERENCES omnidim_agents (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id          BIGINT UNSIGNED NOT NULL,
  menu_item_id      BIGINT UNSIGNED NULL,           -- nullable: item may be deleted later
  name              VARCHAR(180)    NOT NULL,        -- snapshot of item name
  quantity          INT UNSIGNED    NOT NULL DEFAULT 1,
  unit_price        BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- minor units, snapshot
  total_price       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  selected_options  JSON            NULL,           -- chosen modifiers/variants
  notes             VARCHAR(512)    NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_menu_item (menu_item_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_menu_item FOREIGN KEY (menu_item_id)
    REFERENCES menu_items (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- payment_gateways  (per-restaurant gateway configuration)
-- Secrets should live in env / a secrets manager. `credentials` holds only
-- publishable/non-secret config or references; never store raw secret keys here
-- in production.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_gateways (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  provider          ENUM('stripe','razorpay','paypal','square','cash') NOT NULL,
  display_name      VARCHAR(120)    NULL,
  mode              ENUM('test','live') NOT NULL DEFAULT 'test',
  is_active         TINYINT(1)      NOT NULL DEFAULT 0,
  is_default        TINYINT(1)      NOT NULL DEFAULT 0,
  public_key        VARCHAR(255)    NULL,           -- publishable key / key_id
  credentials       JSON            NULL,           -- non-secret config, webhook ids, account id
  supported_currencies JSON         NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gateway_restaurant_provider (restaurant_id, provider),
  KEY idx_gateways_restaurant (restaurant_id),
  CONSTRAINT fk_gateways_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- payments  (one row per payment attempt / link)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NOT NULL,
  order_id          BIGINT UNSIGNED NULL,
  gateway_id        BIGINT UNSIGNED NULL,
  provider          ENUM('stripe','razorpay','paypal','square','cash') NOT NULL,
  provider_payment_id   VARCHAR(128) NULL,          -- pi_..., pay_..., etc.
  provider_intent_id    VARCHAR(128) NULL,          -- payment intent / order id at gateway
  payment_link_id       VARCHAR(128) NULL,
  payment_link_url      VARCHAR(768) NULL,          -- link SMS/WhatsApp'd to customer
  amount            BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- minor units
  currency          CHAR(3)         NOT NULL DEFAULT 'USD',
  status            ENUM('created','link_sent','pending','authorized','paid','failed','cancelled','refunded','partially_refunded','expired')
                      NOT NULL DEFAULT 'created',
  method            VARCHAR(48)     NULL,           -- card, upi, wallet, netbanking...
  amount_refunded   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  failure_reason    VARCHAR(512)    NULL,
  paid_at           TIMESTAMP       NULL,
  raw_payload       JSON            NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_provider_payment (provider, provider_payment_id),
  KEY idx_payments_restaurant (restaurant_id),
  KEY idx_payments_order (order_id),
  KEY idx_payments_status (status),
  KEY idx_payments_intent (provider_intent_id),
  CONSTRAINT fk_payments_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_payments_gateway FOREIGN KEY (gateway_id)
    REFERENCES payment_gateways (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- settings  (flexible per-restaurant key/value config)
-- Scope NULL restaurant_id = global platform setting.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NULL,
  category          VARCHAR(64)     NOT NULL DEFAULT 'general',  -- general, tax, delivery, omnidim, payment, notifications
  `key`             VARCHAR(120)    NOT NULL,
  value             JSON            NULL,
  description       VARCHAR(512)    NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_scope_key (restaurant_id, category, `key`),
  KEY idx_settings_restaurant (restaurant_id),
  CONSTRAINT fk_settings_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- webhooks_log  (raw inbound webhooks from Omnidim / payment gateways)
-- Used for idempotency, audit, and replay/debugging.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhooks_log (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NULL,           -- may be unknown until parsed
  source            ENUM('omnidim','stripe','razorpay','paypal','square','internal') NOT NULL,
  event_type        VARCHAR(120)    NULL,           -- e.g. payment_intent.succeeded, call.completed
  external_event_id VARCHAR(190)    NULL,           -- provider event id for idempotency
  signature_valid   TINYINT(1)      NULL,
  status            ENUM('received','processed','failed','ignored','duplicate') NOT NULL DEFAULT 'received',
  http_status       SMALLINT UNSIGNED NULL,
  related_order_id  BIGINT UNSIGNED NULL,
  related_payment_id BIGINT UNSIGNED NULL,
  related_call_id   BIGINT UNSIGNED NULL,
  headers           JSON            NULL,
  payload           JSON            NULL,
  error_message     TEXT            NULL,
  processed_at      TIMESTAMP       NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_webhooks_source_event (source, external_event_id),
  KEY idx_webhooks_restaurant (restaurant_id),
  KEY idx_webhooks_source (source),
  KEY idx_webhooks_status (status),
  KEY idx_webhooks_created (created_at),
  CONSTRAINT fk_webhooks_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- schema_migrations  (tracks applied migration files)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version           VARCHAR(64)     NOT NULL,
  applied_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO schema_migrations (version) VALUES ('001_init_schema')
  ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
