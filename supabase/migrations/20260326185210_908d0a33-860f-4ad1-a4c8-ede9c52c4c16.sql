
-- View for student/parent-facing reward loading (only visible, active rewards)
CREATE OR REPLACE VIEW public.v_beacon_rewards_by_classroom
WITH (security_invoker = true) AS
SELECT
  r.id, r.name, r.description, r.cost, r.base_cost, r.category, r.emoji,
  r.stock_count, r.active, r.reward_type, r.dynamic_pricing_enabled,
  r.min_cost, r.max_cost, r.current_dynamic_price, r.inventory_enabled,
  r.sort_order, r.metadata_json, r.redemption_count_24h,
  r.scope_type, r.scope_id, r.tier, r.image_url,
  r.agency_id, r.created_at, r.updated_at
FROM public.beacon_rewards r
WHERE r.active = true
  AND r.hidden = false
  AND r.archived = false
  AND r.deleted_at IS NULL;

-- View for admin reward management (all rewards including hidden/archived, excluding soft-deleted)
CREATE OR REPLACE VIEW public.v_beacon_rewards_admin
WITH (security_invoker = true) AS
SELECT
  r.*
FROM public.beacon_rewards r
WHERE r.deleted_at IS NULL;
