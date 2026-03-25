
-- Teams tables
CREATE TABLE IF NOT EXISTS public.classroom_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.classroom_groups(group_id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  team_name text NOT NULL,
  team_color text NOT NULL DEFAULT '#3B82F6',
  team_icon text NOT NULL DEFAULT '⭐',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read classroom teams"
  ON public.classroom_teams FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage classroom teams"
  ON public.classroom_teams FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.classroom_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.classroom_teams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  group_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, group_id)
);

ALTER TABLE public.classroom_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read team members"
  ON public.classroom_team_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage team members"
  ON public.classroom_team_members FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Team scores view
CREATE OR REPLACE VIEW public.v_classroom_team_scores AS
SELECT
  t.id AS team_id,
  t.group_id,
  t.team_name,
  t.team_color,
  t.team_icon,
  COALESCE(SUM(pl.points), 0)::bigint AS total_points,
  COUNT(DISTINCT tm.student_id)::integer AS member_count
FROM public.classroom_teams t
LEFT JOIN public.classroom_team_members tm ON tm.team_id = t.id
LEFT JOIN public.beacon_points_ledger pl ON pl.student_id = tm.student_id
GROUP BY t.id, t.group_id, t.team_name, t.team_color, t.team_icon;

-- Daily quests tables
CREATE TABLE IF NOT EXISTS public.daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  group_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  quest_type text NOT NULL DEFAULT 'points_total',
  target_value integer NOT NULL DEFAULT 10,
  reward_bonus integer NOT NULL DEFAULT 5,
  active_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quests"
  ON public.daily_quests FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage quests"
  ON public.daily_quests FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.daily_quest_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL REFERENCES public.daily_quests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  bonus_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quest_id, student_id)
);

ALTER TABLE public.daily_quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quest progress"
  ON public.daily_quest_progress FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage quest progress"
  ON public.daily_quest_progress FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Enable realtime for teams
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_quest_progress;
