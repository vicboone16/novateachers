
-- Add identity and momentum columns to student_game_profiles
ALTER TABLE public.student_game_profiles
  ADD COLUMN IF NOT EXISTS identity_title text,
  ADD COLUMN IF NOT EXISTS identity_emoji text,
  ADD COLUMN IF NOT EXISTS momentum_state text DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS comeback_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_narrative text,
  ADD COLUMN IF NOT EXISTS daily_narrative_at timestamptz;

-- Create parent_reinforcement_events table for tracking parent feedback effects
CREATE TABLE IF NOT EXISTS public.parent_reinforcement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  parent_action_id uuid,
  action_type text NOT NULL,
  bonus_points_awarded integer DEFAULT 0,
  momentum_boost boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_reinforcement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open select parent_reinforcement_events" ON public.parent_reinforcement_events
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert parent_reinforcement_events" ON public.parent_reinforcement_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
