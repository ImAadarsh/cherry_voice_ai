-- Customer-facing order/reservation pages + onboarding completion tracking

ALTER TABLE restaurants
  ADD COLUMN onboarding_completed_at TIMESTAMP NULL DEFAULT NULL AFTER status;

ALTER TABLE orders
  ADD COLUMN customer_page_token CHAR(32) NULL DEFAULT NULL AFTER order_number,
  ADD UNIQUE KEY uq_orders_customer_page_token (customer_page_token);

ALTER TABLE reservations
  ADD COLUMN customer_page_token CHAR(32) NULL DEFAULT NULL AFTER id,
  ADD UNIQUE KEY uq_reservations_customer_page_token (customer_page_token);

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
