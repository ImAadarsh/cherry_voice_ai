-- Customer-facing order/reservation pages + onboarding completion tracking

SET @db := DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'restaurants' AND column_name = 'onboarding_completed_at'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE restaurants ADD COLUMN onboarding_completed_at TIMESTAMP NULL DEFAULT NULL AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'orders' AND column_name = 'customer_page_token'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE orders ADD COLUMN customer_page_token CHAR(32) NULL DEFAULT NULL AFTER order_number, ADD UNIQUE KEY uq_orders_customer_page_token (customer_page_token)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'reservations' AND column_name = 'customer_page_token'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE reservations ADD COLUMN customer_page_token CHAR(32) NULL DEFAULT NULL AFTER id, ADD UNIQUE KEY uq_reservations_customer_page_token (customer_page_token)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill onboarding completion for restaurants that already finished setup
UPDATE restaurants r
SET onboarding_completed_at = COALESCE(
  (SELECT MIN(oa.created_at) FROM omnidim_agents oa WHERE oa.restaurant_id = r.id),
  r.updated_at
)
WHERE onboarding_completed_at IS NULL
  AND EXISTS (SELECT 1 FROM omnidim_agents oa WHERE oa.restaurant_id = r.id)
  AND EXISTS (SELECT 1 FROM menu_items mi WHERE mi.restaurant_id = r.id)
  AND r.city IS NOT NULL
  AND r.country IS NOT NULL;

INSERT IGNORE INTO schema_migrations (version) VALUES ('009_customer_pages');
