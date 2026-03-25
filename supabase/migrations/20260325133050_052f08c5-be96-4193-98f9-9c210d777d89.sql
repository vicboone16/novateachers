
-- ============================================
-- Beacon Rewards, Redemptions, Unlocks, Streaks
-- ============================================

-- 1. beacon_rewards — reward store catalog
CREATE TABLE public.beacon_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_type TEXT NOT NULL DEFAULT 'agency',
  scope_id UUID NOT NULL,
  agency_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL DEFAULT 10,
  category TEXT NOT NULL DEFAULT 'tangible',
  emoji TEXT NOT NULL DEFAULT '🎁',
  image_url TEXT,
  stock_count INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  time_sensitive_until TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beacon_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active rewards"
  ON public.beacon_rewards FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert rewards"
  ON public.beacon_rewards FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rewards"
  ON public.beacon_rewards FOR UPDATE TO authenticated
  USING (true);

-- 2. beacon_reward_redemptions — redemption history
CREATE TABLE public.beacon_reward_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  reward_id UUID NOT NULL REFERENCES public.beacon_rewards(id),
  staff_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beacon_reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read redemptions"
  ON public.beacon_reward_redemptions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert redemptions"
  ON public.beacon_reward_redemptions FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. unlock_catalog — cosmetic/badge unlocks
CREATE TABLE public.unlock_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID,
  unlock_type TEXT NOT NULL DEFAULT 'badge',
  unlock_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT NOT NULL DEFAULT '🏆',
  points_required INTEGER NOT NULL DEFAULT 0,
  level_required INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.unlock_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read unlock catalog"
  ON public.unlock_catalog FOR SELECT TO authenticated
  USING (true);

-- Seed default unlocks
INSERT INTO public.unlock_catalog (unlock_type, unlock_key, name, description, icon_emoji, points_required, level_required) VALUES
  ('badge', 'first_points', 'First Points!', 'Earned your very first points', '⭐', 1, 1),
  ('badge', 'point_collector', 'Point Collector', 'Earned 50 total points', '💎', 50, 2),
  ('badge', 'century_club', 'Century Club', 'Earned 100 total points', '💯', 100, 3),
  ('badge', 'superstar', 'Superstar', 'Reached Level 5', '🌟', 0, 5),
  ('badge', 'legend', 'Legend', 'Reached Level 10', '👑', 0, 10),
  ('avatar_item', 'crown', 'Golden Crown', 'A shiny crown for your avatar', '👑', 200, 5),
  ('avatar_item', 'sunglasses', 'Cool Shades', 'Stylish sunglasses', '😎', 100, 3),
  ('avatar_item', 'cape', 'Hero Cape', 'A heroic cape', '🦸', 150, 4),
  ('trail_effect', 'sparkle', 'Sparkle Trail', 'Leave sparkles wherever you go', '✨', 300, 7),
  ('trail_effect', 'fire', 'Fire Trail', 'Blazing fire trail', '🔥', 500, 10);

-- 4. student_unlocks — what each student has unlocked
CREATE TABLE public.student_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  unlock_id UUID NOT NULL REFERENCES public.unlock_catalog(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(student_id, unlock_id)
);

ALTER TABLE public.student_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read unlocks"
  ON public.student_unlocks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert unlocks"
  ON public.student_unlocks FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5. student_streaks — streak tracking
CREATE TABLE public.student_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  streak_type TEXT NOT NULL DEFAULT 'daily_points',
  current_count INTEGER NOT NULL DEFAULT 0,
  best_count INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, streak_type)
);

ALTER TABLE public.student_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read streaks"
  ON public.student_streaks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upsert streaks"
  ON public.student_streaks FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update streaks"
  ON public.student_streaks FOR UPDATE TO authenticated
  USING (true);

-- 6. Add is_active column to token_boards for soft-delete
ALTER TABLE public.token_boards ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.token_boards ADD COLUMN IF NOT EXISTS token_goal INTEGER GENERATED ALWAYS AS (token_target) STORED;

-- 7. Trigger: auto-unlock badges on level-up
CREATE OR REPLACE FUNCTION public.auto_unlock_on_level_up()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-unlock any catalog items where student meets requirements
  INSERT INTO public.student_unlocks (student_id, unlock_id)
  SELECT NEW.student_id, uc.id
  FROM public.unlock_catalog uc
  WHERE uc.is_active = true
    AND uc.level_required <= NEW.current_level
    AND uc.points_required <= NEW.current_xp
    AND NOT EXISTS (
      SELECT 1 FROM public.student_unlocks su
      WHERE su.student_id = NEW.student_id AND su.unlock_id = uc.id
    )
  ON CONFLICT (student_id, unlock_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_unlock_on_level_up
  AFTER UPDATE OF current_level ON public.student_game_profiles
  FOR EACH ROW
  WHEN (NEW.current_level > OLD.current_level)
  EXECUTE FUNCTION public.auto_unlock_on_level_up();

-- 8. Trigger: update daily streak on points
CREATE OR REPLACE FUNCTION public.update_student_streak()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_last_date DATE;
  v_current INTEGER;
  v_best INTEGER;
BEGIN
  IF NEW.points <= 0 THEN RETURN NEW; END IF;

  SELECT last_activity_date, current_count, best_count
  INTO v_last_date, v_current, v_best
  FROM public.student_streaks
  WHERE student_id = NEW.student_id AND streak_type = 'daily_points';

  IF NOT FOUND THEN
    INSERT INTO public.student_streaks (student_id, streak_type, current_count, best_count, last_activity_date)
    VALUES (NEW.student_id, 'daily_points', 1, 1, CURRENT_DATE);
  ELSIF v_last_date = CURRENT_DATE THEN
    -- Same day, no change
    NULL;
  ELSIF v_last_date = CURRENT_DATE - 1 THEN
    -- Consecutive day
    UPDATE public.student_streaks
    SET current_count = v_current + 1,
        best_count = GREATEST(v_best, v_current + 1),
        last_activity_date = CURRENT_DATE
    WHERE student_id = NEW.student_id AND streak_type = 'daily_points';
  ELSE
    -- Streak broken
    UPDATE public.student_streaks
    SET current_count = 1, last_activity_date = CURRENT_DATE
    WHERE student_id = NEW.student_id AND streak_type = 'daily_points';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_student_streak
  AFTER INSERT ON public.beacon_points_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_streak();

-- Enable realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.beacon_rewards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.beacon_reward_redemptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_unlocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_streaks;

-- RPC: redeem reward (atomic point deduction + redemption insert)
CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_student_id UUID,
  p_reward_id UUID,
  p_staff_id UUID,
  p_agency_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_reward public.beacon_rewards;
  v_balance BIGINT;
  v_redemption_id UUID;
  v_ledger_id UUID;
BEGIN
  SELECT * INTO v_reward FROM public.beacon_rewards WHERE id = p_reward_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reward not found or inactive');
  END IF;

  IF v_reward.stock_count IS NOT NULL AND v_reward.stock_count <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Out of stock');
  END IF;

  -- Check balance
  SELECT COALESCE(SUM(points), 0) INTO v_balance
  FROM public.beacon_points_ledger
  WHERE student_id = p_student_id AND agency_id = p_agency_id;

  IF v_balance < v_reward.cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient points', 'balance', v_balance, 'cost', v_reward.cost);
  END IF;

  -- Insert redemption
  INSERT INTO public.beacon_reward_redemptions (student_id, reward_id, staff_id, agency_id, points_spent)
  VALUES (p_student_id, p_reward_id, p_staff_id, p_agency_id, v_reward.cost)
  RETURNING id INTO v_redemption_id;

  -- Deduct points
  INSERT INTO public.beacon_points_ledger (agency_id, student_id, staff_id, points, source, reason, entry_kind)
  VALUES (p_agency_id, p_student_id, p_staff_id, -v_reward.cost, 'reward_redeem', 'Redeemed: ' || v_reward.name, 'redemption')
  RETURNING id INTO v_ledger_id;

  -- Decrement stock
  IF v_reward.stock_count IS NOT NULL THEN
    UPDATE public.beacon_rewards SET stock_count = GREATEST(0, stock_count - 1) WHERE id = p_reward_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'redemption_id', v_redemption_id, 'ledger_id', v_ledger_id, 'points_spent', v_reward.cost);
END;
$$;
