-- ============================================================================
-- Migration 002: Seed data (demo restaurant, admin, menu, agent, gateways)
-- Safe to run multiple times (uses INSERT ... ON DUPLICATE KEY UPDATE / IGNORE).
-- Amounts are in minor units (USD cents).
-- ============================================================================

SET NAMES utf8mb4;

-- Demo restaurant (tenant) ---------------------------------------------------
INSERT INTO restaurants (id, name, slug, email, phone, timezone, currency, city, country, status)
VALUES (1, 'Cherry Bistro', 'cherry-bistro', 'owner@cherrybistro.test', '+15551230000',
        'America/New_York', 'USD', 'New York', 'US', 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Admin user (password_hash is a bcrypt hash of "ChangeMe123!" — reset in prod)
INSERT INTO users (id, restaurant_id, name, email, password_hash, role, is_active)
VALUES (1, 1, 'Restaurant Owner', 'owner@cherrybistro.test',
        '$2b$10$Y9CPBrs5zuygrjDOdjrmjuGQkkZoF9FOBRMt2lzVLWqCCHv/HMVly', 'owner', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Menu categories ------------------------------------------------------------
INSERT INTO menu_categories (id, restaurant_id, name, sort_order, is_active) VALUES
  (1, 1, 'Starters',   1, 1),
  (2, 1, 'Mains',      2, 1),
  (3, 1, 'Pizzas',     3, 1),
  (4, 1, 'Beverages',  4, 1),
  (5, 1, 'Desserts',   5, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Menu items -----------------------------------------------------------------
INSERT INTO menu_items (restaurant_id, category_id, sku, name, description, price, currency, is_vegetarian, is_available) VALUES
  (1, 1, 'ST-01', 'Garlic Bread',        'Toasted with herb butter',            599,  'USD', 1, 1),
  (1, 1, 'ST-02', 'Chicken Wings',       'Six pieces, buffalo sauce',           899,  'USD', 0, 1),
  (1, 3, 'PZ-01', 'Margherita Pizza',    'Tomato, mozzarella, basil',          1299,  'USD', 1, 1),
  (1, 3, 'PZ-02', 'Pepperoni Pizza',     'Classic pepperoni & cheese',         1499,  'USD', 0, 1),
  (1, 2, 'MN-01', 'Grilled Salmon',      'With seasonal vegetables',           1899,  'USD', 0, 1),
  (1, 2, 'MN-02', 'Veggie Pasta',        'Penne in tomato basil sauce',        1199,  'USD', 1, 1),
  (1, 4, 'BV-01', 'Fresh Lemonade',      'House-made',                          399,  'USD', 1, 1),
  (1, 4, 'BV-02', 'Cola',                'Chilled can',                         249,  'USD', 1, 1),
  (1, 5, 'DS-01', 'Chocolate Lava Cake', 'Warm, molten center',                 699,  'USD', 1, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price);

-- Payment gateways (config only; secrets live in .env) -----------------------
INSERT INTO payment_gateways (restaurant_id, provider, display_name, mode, is_active, is_default, supported_currencies)
VALUES
  (1, 'stripe',   'Stripe',   'test', 1, 1, JSON_ARRAY('USD','EUR','GBP')),
  (1, 'razorpay', 'Razorpay', 'test', 1, 0, JSON_ARRAY('INR','USD'))
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- Omnidim agent mapping (replace omnidim_agent_id with a real id from your account)
INSERT INTO omnidim_agents (restaurant_id, omnidim_agent_id, name, direction, is_active)
VALUES (1, 'REPLACE_WITH_OMNIDIM_AGENT_ID', 'Cherry Bistro Order Line', 'inbound', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Default restaurant settings ------------------------------------------------
-- `value` is JSON; we insert literal JSON strings (numbers, booleans, quoted
-- strings) which are valid JSON in both MySQL and MariaDB.
INSERT INTO settings (restaurant_id, category, `key`, value, description) VALUES
  (1, 'tax',       'rate_percent',        '"8.875"', 'Sales tax rate applied to subtotal'),
  (1, 'delivery',  'fee',                 '499',     'Flat delivery fee in minor units'),
  (1, 'delivery',  'min_order',           '1500',    'Minimum order for delivery in minor units'),
  (1, 'payment',   'default_provider',    '"stripe"','Default gateway for new payment links'),
  (1, 'payment',   'link_expiry_minutes', '60',      'Payment link validity window'),
  (1, 'notifications', 'send_payment_link_sms', 'true', 'SMS the payment link after a voice order'),
  (1, 'omnidim',   'auto_create_order',   'true',    'Create an order automatically on order.placed webhook')
ON DUPLICATE KEY UPDATE value = VALUES(value);

INSERT INTO schema_migrations (version) VALUES ('002_seed_data')
  ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;
