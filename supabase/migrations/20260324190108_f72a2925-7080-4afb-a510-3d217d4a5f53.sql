
-- Student Reinforcement Profiles
CREATE TABLE IF NOT EXISTS public.student_reinforcement_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  student_id uuid NOT NULL,
  classroom_id uuid NULL,
  reinforcement_template_id uuid NULL REFERENCES public.beacon_reinforcement_templates(id) ON DELETE SET NULL,
  profile_name text NULL,
  reinforcement_mode text NOT NULL DEFAULT 'template',
  use_template_defaults boolean NOT NULL DEFAULT true,
  response_cost_enabled boolean NOT NULL DEFAULT false,
  bonus_points_enabled boolean NOT NULL DEFAULT true,
  custom_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_reinforcement_profiles_student
  ON public.student_reinforcement_profiles (student_id, is_active);

CREATE INDEX IF NOT EXISTS idx_student_reinforcement_profiles_classroom
  ON public.student_reinforcement_profiles (classroom_id, is_active);

ALTER TABLE public.student_reinforcement_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open all student_reinforcement_profiles"
  ON public.student_reinforcement_profiles FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Student Reinforcement Rules
CREATE TABLE IF NOT EXISTS public.student_reinforcement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_reinforcement_profile_id uuid NOT NULL REFERENCES public.student_reinforcement_profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  rule_scope text NOT NULL,
  linked_target_id uuid NULL,
  behavior_name text NULL,
  behavior_category text NULL,
  event_type text NULL,
  rule_type text NOT NULL DEFAULT 'reward',
  points integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_reinforcement_rules_student
  ON public.student_reinforcement_rules (student_id, is_active);

ALTER TABLE public.student_reinforcement_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open all student_reinforcement_rules"
  ON public.student_reinforcement_rules FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);
