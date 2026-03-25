
-- Economy settings per agency/classroom
CREATE TABLE public.reward_economy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  classroom_id UUID,
  dynamic_pricing_enabled BOOLEAN NOT NULL DEFAULT false,
  price_update_interval_hours INTEGER NOT NULL DEFAULT 24,
  demand_weight NUMERIC(3,2) NOT NULL DEFAULT 0.3,
  scarcity_weight NUMERIC(3,2) NOT NULL DEFAULT 0.2,
  max_price_increase_pct INTEGER NOT NULL DEFAULT 50,
  max_price_decrease_pct INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, classroom_id)
);

ALTER TABLE public.reward_economy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read economy settings"
  ON public.reward_economy_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage economy settings"
  ON public.reward_economy_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reward transactions log (richer than redemptions)
CREATE TABLE public.reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  student_id UUID NOT NULL,
  reward_id UUID NOT NULL REFERENCES public.beacon_rewards(id),
  staff_id UUID NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'redemption',
  base_price INTEGER NOT NULL,
  final_price INTEGER NOT NULL,
  price_modifier TEXT,
  points_before INTEGER NOT NULL DEFAULT 0,
  points_after INTEGER NOT NULL DEFAULT 0,
  ledger_entry_id UUID,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reward transactions"
  ON public.reward_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert reward transactions"
  ON public.reward_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- Add economy columns to beacon_rewards
ALTER TABLE public.beacon_rewards
  ADD COLUMN IF NOT EXISTS base_cost INTEGER,
  ADD COLUMN IF NOT EXISTS reward_type TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS dynamic_pricing_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_cost INTEGER,
  ADD COLUMN IF NOT EXISTS max_cost INTEGER,
  ADD COLUMN IF NOT EXISTS current_dynamic_price INTEGER,
  ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inventory_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS redemption_count_24h INTEGER NOT NULL DEFAULT 0;

-- Backfill base_cost from cost
UPDATE public.beacon_rewards SET base_cost = cost WHERE base_cost IS NULL;

-- Dynamic price computation function
CREATE OR REPLACE FUNCTION public.compute_dynamic_reward_price(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_reward public.beacon_rewards;
  v_settings public.reward_economy_settings;
  v_base INTEGER;
  v_final INTEGER;
  v_modifier TEXT := 'none';
  v_recent_redemptions INTEGER;
  v_avg_redemptions NUMERIC;
  v_demand_ratio NUMERIC;
  v_stock_ratio NUMERIC;
  v_price_factor NUMERIC := 1.0;
BEGIN
  SELECT * INTO v_reward FROM public.beacon_rewards WHERE id = p_reward_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reward not found');
  END IF;

  v_base := COALESCE(v_reward.base_cost, v_reward.cost);

  IF NOT v_reward.dynamic_pricing_enabled THEN
    RETURN jsonb_build_object('ok', true, 'base_price', v_base, 'final_price', v_base, 'modifier', 'static');
  END IF;

  -- Get economy settings
  SELECT * INTO v_settings FROM public.reward_economy_settings
  WHERE agency_id = v_reward.agency_id
  ORDER BY CASE WHEN classroom_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'base_price', v_base, 'final_price', v_base, 'modifier', 'no_settings');
  END IF;

  -- Count recent redemptions (24h)
  SELECT COUNT(*) INTO v_recent_redemptions
  FROM public.beacon_reward_redemptions
  WHERE reward_id = p_reward_id AND redeemed_at >= now() - interval '24 hours';

  -- Average redemptions across all active rewards
  SELECT COALESCE(AVG(sub.cnt), 0) INTO v_avg_redemptions
  FROM (
    SELECT COUNT(*) as cnt
    FROM public.beacon_reward_redemptions rr
    JOIN public.beacon_rewards br ON br.id = rr.reward_id
    WHERE br.agency_id = v_reward.agency_id AND br.active = true
      AND rr.redeemed_at >= now() - interval '24 hours'
    GROUP BY rr.reward_id
  ) sub;

  -- Demand ratio
  IF v_avg_redemptions > 0 THEN
    v_demand_ratio := v_recent_redemptions::numeric / GREATEST(v_avg_redemptions, 1);
  ELSE
    v_demand_ratio := 1.0;
  END IF;

  -- Apply demand factor
  IF v_demand_ratio > 1.5 THEN
    v_price_factor := 1.0 + (v_settings.demand_weight * LEAST(v_demand_ratio - 1.0, 1.0));
    v_modifier := 'hot';
  ELSIF v_demand_ratio < 0.5 AND v_recent_redemptions = 0 THEN
    v_price_factor := 1.0 - (v_settings.demand_weight * 0.5);
    v_modifier := 'sale';
  END IF;

  -- Scarcity factor
  IF v_reward.inventory_enabled AND v_reward.stock_count IS NOT NULL AND v_reward.stock_count > 0 THEN
    v_stock_ratio := v_reward.stock_count::numeric / GREATEST(COALESCE((v_reward.metadata_json->>'initial_stock')::integer, v_reward.stock_count), 1);
    IF v_stock_ratio < 0.3 THEN
      v_price_factor := v_price_factor + (v_settings.scarcity_weight * (1.0 - v_stock_ratio));
      IF v_modifier = 'none' THEN v_modifier := 'scarce'; END IF;
    END IF;
  END IF;

  -- Compute final with caps
  v_final := ROUND(v_base * v_price_factor);

  -- Apply min/max caps
  IF v_reward.min_cost IS NOT NULL THEN
    v_final := GREATEST(v_final, v_reward.min_cost);
  END IF;
  IF v_reward.max_cost IS NOT NULL THEN
    v_final := LEAST(v_final, v_reward.max_cost);
  END IF;

  -- Apply global caps
  v_final := GREATEST(v_final, ROUND(v_base * (1.0 - v_settings.max_price_decrease_pct::numeric / 100)));
  v_final := LEAST(v_final, ROUND(v_base * (1.0 + v_settings.max_price_increase_pct::numeric / 100)));

  -- Ensure at least 1
  v_final := GREATEST(v_final, 1);

  -- Update cached price
  UPDATE public.beacon_rewards
  SET current_dynamic_price = v_final, last_price_update = now(), redemption_count_24h = v_recent_redemptions
  WHERE id = p_reward_id;

  RETURN jsonb_build_object(
    'ok', true,
    'base_price', v_base,
    'final_price', v_final,
    'modifier', v_modifier,
    'demand_ratio', ROUND(v_demand_ratio, 2),
    'price_factor', ROUND(v_price_factor, 2),
    'recent_redemptions', v_recent_redemptions
  );
END;
$$;

-- Dynamic redemption RPC
CREATE OR REPLACE FUNCTION public.redeem_reward_dynamic(
  p_student_id UUID,
  p_reward_id UUID,
  p_staff_id UUID,
  p_agency_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_price_info JSONB;
  v_final_price INTEGER;
  v_base_price INTEGER;
  v_modifier TEXT;
  v_balance BIGINT;
  v_reward public.beacon_rewards;
  v_redemption_id UUID;
  v_ledger_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Compute current price
  v_price_info := public.compute_dynamic_reward_price(p_reward_id);
  IF NOT (v_price_info->>'ok')::boolean THEN
    RETURN v_price_info;
  END IF;

  v_final_price := (v_price_info->>'final_price')::integer;
  v_base_price := (v_price_info->>'base_price')::integer;
  v_modifier := v_price_info->>'modifier';

  -- Load reward
  SELECT * INTO v_reward FROM public.beacon_rewards WHERE id = p_reward_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reward not found or inactive');
  END IF;

  -- Check inventory
  IF v_reward.inventory_enabled AND v_reward.stock_count IS NOT NULL AND v_reward.stock_count <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Out of stock');
  END IF;

  -- Check balance
  SELECT COALESCE(SUM(points), 0) INTO v_balance
  FROM public.beacon_points_ledger
  WHERE student_id = p_student_id AND agency_id = p_agency_id;

  IF v_balance < v_final_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient points', 'balance', v_balance, 'cost', v_final_price);
  END IF;

  -- Insert redemption
  INSERT INTO public.beacon_reward_redemptions (student_id, reward_id, staff_id, agency_id, points_spent)
  VALUES (p_student_id, p_reward_id, p_staff_id, p_agency_id, v_final_price)
  RETURNING id INTO v_redemption_id;

  -- Deduct points
  INSERT INTO public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, entry_kind)
  VALUES (p_agency_id, p_student_id, p_staff_id, -v_final_price, 'reward_redeem', 'Redeemed: ' || v_reward.name, 'redemption')
  RETURNING id INTO v_ledger_id;

  -- Log transaction
  INSERT INTO public.reward_transactions (agency_id, student_id, reward_id, staff_id, transaction_type, base_price, final_price, price_modifier, points_before, points_after, ledger_entry_id)
  VALUES (p_agency_id, p_student_id, p_reward_id, p_staff_id, 'redemption', v_base_price, v_final_price, v_modifier, v_balance, v_balance - v_final_price, v_ledger_id)
  RETURNING id INTO v_transaction_id;

  -- Decrement inventory
  IF v_reward.inventory_enabled AND v_reward.stock_count IS NOT NULL THEN
    UPDATE public.beacon_rewards SET stock_count = GREATEST(0, stock_count - 1) WHERE id = p_reward_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'transaction_id', v_transaction_id,
    'ledger_id', v_ledger_id,
    'base_price', v_base_price,
    'final_price', v_final_price,
    'modifier', v_modifier,
    'points_spent', v_final_price,
    'balance_after', v_balance - v_final_price
  );
END;
$$;

-- Enable realtime for transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_transactions;
