
-- 1. Create missing tables
CREATE TABLE IF NOT EXISTS public.reward_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.beacon_rewards(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  classroom_id uuid,
  quantity_available integer NOT NULL DEFAULT 0,
  is_limited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reward_id, classroom_id)
);

CREATE TABLE IF NOT EXISTS public.reward_dynamic_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.beacon_rewards(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  classroom_id uuid,
  computed_price integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add tier column to beacon_rewards if missing
DO $$ BEGIN
  ALTER TABLE public.beacon_rewards ADD COLUMN tier text NOT NULL DEFAULT 'standard';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. RLS on new tables
ALTER TABLE public.reward_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_dynamic_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_reward_inventory" ON public.reward_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_reward_dynamic_prices" ON public.reward_dynamic_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Missing RPCs
CREATE OR REPLACE FUNCTION public.override_reward_price(
  p_agency_id uuid,
  p_reward_id uuid,
  p_new_price integer,
  p_created_by uuid DEFAULT NULL,
  p_reason text DEFAULT 'Manual override'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.beacon_rewards
  SET current_dynamic_price = p_new_price,
      last_price_update = now(),
      updated_at = now()
  WHERE id = p_reward_id;

  INSERT INTO public.reward_dynamic_prices (reward_id, agency_id, computed_price, reason, created_by)
  VALUES (p_reward_id, p_agency_id, p_new_price, p_reason, p_created_by);

  INSERT INTO public.reward_transactions (agency_id, student_id, reward_id, staff_id, transaction_type, base_price, final_price, price_modifier, metadata_json)
  VALUES (p_agency_id, '00000000-0000-0000-0000-000000000000', p_reward_id, coalesce(p_created_by, '00000000-0000-0000-0000-000000000000'), 'price_change', 
    (SELECT cost FROM public.beacon_rewards WHERE id = p_reward_id), p_new_price, 'manual_override',
    jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('ok', true, 'new_price', p_new_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_reward_inventory(
  p_agency_id uuid,
  p_reward_id uuid,
  p_quantity integer,
  p_created_by uuid DEFAULT NULL,
  p_classroom_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_qty integer;
BEGIN
  INSERT INTO public.reward_inventory (reward_id, agency_id, classroom_id, quantity_available, is_limited)
  VALUES (p_reward_id, p_agency_id, p_classroom_id, p_quantity, true)
  ON CONFLICT (reward_id, classroom_id) DO UPDATE
  SET quantity_available = reward_inventory.quantity_available + p_quantity,
      updated_at = now()
  RETURNING quantity_available INTO v_new_qty;

  UPDATE public.beacon_rewards
  SET stock_count = v_new_qty, inventory_enabled = true, updated_at = now()
  WHERE id = p_reward_id;

  INSERT INTO public.reward_transactions (agency_id, student_id, reward_id, staff_id, transaction_type, base_price, final_price, price_modifier, metadata_json)
  VALUES (p_agency_id, '00000000-0000-0000-0000-000000000000', p_reward_id, coalesce(p_created_by, '00000000-0000-0000-0000-000000000000'), 'inventory_add',
    0, 0, null, jsonb_build_object('quantity_added', p_quantity, 'new_total', v_new_qty));

  RETURN jsonb_build_object('ok', true, 'new_quantity', v_new_qty);
END;
$$;

-- 5. Views
CREATE OR REPLACE VIEW public.v_reward_store WITH (security_invoker = on) AS
SELECT
  r.id,
  r.scope_type,
  r.scope_id,
  r.agency_id,
  r.name,
  r.emoji,
  r.cost,
  r.base_cost,
  r.reward_type,
  r.tier,
  r.dynamic_pricing_enabled,
  r.inventory_enabled,
  r.active,
  r.sort_order,
  r.min_cost,
  r.max_cost,
  r.description,
  r.current_dynamic_price,
  r.stock_count,
  r.redemption_count_24h,
  i.quantity_available,
  i.is_limited
FROM public.beacon_rewards r
LEFT JOIN public.reward_inventory i ON i.reward_id = r.id
WHERE r.active = true;

CREATE OR REPLACE VIEW public.v_student_reward_history WITH (security_invoker = on) AS
SELECT
  rt.id,
  rt.agency_id,
  rt.student_id,
  rt.reward_id,
  rt.transaction_type,
  rt.final_price AS point_cost,
  rt.points_before AS balance_before,
  rt.points_after AS balance_after,
  rt.metadata_json,
  rt.created_at,
  r.name AS reward_name,
  r.emoji AS reward_emoji
FROM public.reward_transactions rt
LEFT JOIN public.beacon_rewards r ON r.id = rt.reward_id;
