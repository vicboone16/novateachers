
-- Create student_game_profiles table
CREATE TABLE public.student_game_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '👤',
  avatar_items JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_level INTEGER NOT NULL DEFAULT 1,
  current_xp INTEGER NOT NULL DEFAULT 0,
  portal_enabled BOOLEAN NOT NULL DEFAULT false,
  login_mode TEXT NOT NULL DEFAULT 'code',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id)
);

-- Enable RLS
ALTER TABLE public.student_game_profiles ENABLE ROW LEVEL SECURITY;

-- Open policies for authenticated users
CREATE POLICY "Authenticated users can read game profiles"
  ON public.student_game_profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert game profiles"
  ON public.student_game_profiles FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update game profiles"
  ON public.student_game_profiles FOR UPDATE
  TO authenticated USING (true);

-- Allow anon read for student portal access
CREATE POLICY "Anon can read game profiles"
  ON public.student_game_profiles FOR SELECT
  TO anon USING (true);

-- Auto-update updated_at
CREATE TRIGGER set_student_game_profiles_updated_at
  BEFORE UPDATE ON public.student_game_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- XP/Level trigger: on beacon_points_ledger INSERT, update student's xp and level
-- Level thresholds: 1→2=20, 2→3=30, 3→4=50, 4→5=80, 5→6=120, etc.
CREATE OR REPLACE FUNCTION public.update_student_xp_on_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_xp INTEGER;
  v_level INTEGER;
  v_thresholds INTEGER[] := ARRAY[20, 30, 50, 80, 120, 170, 230, 300, 380, 470];
  v_threshold INTEGER;
  v_remaining_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Only process positive points (not reversals)
  IF NEW.points <= 0 OR NEW.is_reversal = true THEN
    RETURN NEW;
  END IF;

  -- Upsert profile if not exists
  INSERT INTO public.student_game_profiles (student_id, agency_id)
  VALUES (NEW.student_id, NEW.agency_id)
  ON CONFLICT (student_id) DO NOTHING;

  -- Get current xp and level
  SELECT current_xp, current_level INTO v_xp, v_level
  FROM public.student_game_profiles
  WHERE student_id = NEW.student_id;

  -- Add points as XP
  v_xp := v_xp + NEW.points;
  v_new_level := v_level;

  -- Check level ups (carry over extra XP)
  LOOP
    IF v_new_level > array_length(v_thresholds, 1) THEN
      EXIT; -- Max level reached
    END IF;
    v_threshold := v_thresholds[v_new_level];
    IF v_xp >= v_threshold THEN
      v_xp := v_xp - v_threshold;
      v_new_level := v_new_level + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Update profile
  UPDATE public.student_game_profiles
  SET current_xp = v_xp,
      current_level = v_new_level,
      updated_at = now()
  WHERE student_id = NEW.student_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_xp_on_points
  AFTER INSERT ON public.beacon_points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_student_xp_on_points();

-- Enable realtime for game profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_game_profiles;
