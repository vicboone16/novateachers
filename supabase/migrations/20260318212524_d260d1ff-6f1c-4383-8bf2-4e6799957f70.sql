-- Reinforcement Templates
CREATE TABLE public.beacon_reinforcement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  age_band text NOT NULL DEFAULT 'all', -- k2, 3to5, 6to8, 9to12, all
  category text NOT NULL DEFAULT 'custom', -- early_learner, externalizing_sdc, internalizing, pbis, middle_xp, high_credits, custom
  is_preset boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- config shape: { behaviors: [{name, points}], engagement_points, probe_correct_points, dro_interval_minutes, dro_points, response_cost_enabled, display_currency }
  agency_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beacon_reinforcement_templates ENABLE ROW LEVEL SECURITY;

-- Presets are visible to all authenticated; custom ones to creator
CREATE POLICY "Anyone can read preset templates"
  ON public.beacon_reinforcement_templates FOR SELECT TO authenticated
  USING (is_preset = true);

CREATE POLICY "Creator can manage custom templates"
  ON public.beacon_reinforcement_templates FOR ALL TO authenticated
  USING (is_preset = false AND created_by = auth.uid())
  WITH CHECK (is_preset = false AND created_by = auth.uid());

-- Link a template to a classroom group
CREATE TABLE public.beacon_classroom_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.classroom_groups(group_id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.beacon_reinforcement_templates(id) ON DELETE CASCADE,
  applied_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id)
);

ALTER TABLE public.beacon_classroom_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage classroom templates"
  ON public.beacon_classroom_templates FOR ALL TO authenticated
  USING (applied_by = auth.uid())
  WITH CHECK (applied_by = auth.uid());

CREATE POLICY "Anyone can read classroom templates"
  ON public.beacon_classroom_templates FOR SELECT TO authenticated
  USING (true);

-- Classroom feed posts (Brightwheel-style)
CREATE TABLE public.classroom_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.classroom_groups(group_id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  author_id uuid NOT NULL,
  post_type text NOT NULL DEFAULT 'update', -- update, celebration, announcement, photo
  title text,
  body text NOT NULL,
  media_url text,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Author can manage own posts"
  ON public.classroom_feed_posts FOR ALL TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Classroom members can read posts"
  ON public.classroom_feed_posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classroom_group_teachers t
      WHERE t.group_id = classroom_feed_posts.group_id AND t.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM classroom_groups g
      WHERE g.group_id = classroom_feed_posts.group_id AND g.created_by = auth.uid()
    )
  );

-- Enable realtime for feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_feed_posts;

-- Seed preset templates
INSERT INTO public.beacon_reinforcement_templates (name, description, age_band, category, is_preset, config) VALUES
(
  'Early Learner Token Board',
  'Dense reinforcement with visual token boards. Ideal for K-2 and early learners with ASD.',
  'k2',
  'early_learner',
  true,
  '{"display_currency":"stars","engagement_points":1,"probe_correct_points":2,"dro_interval_minutes":3,"dro_points":2,"response_cost_enabled":false,"behaviors":[{"name":"Following directions","points":2},{"name":"Transition calmly","points":2},{"name":"Ask for break","points":3},{"name":"Clean up","points":1}]}'::jsonb
),
(
  'Externalizing SDC',
  'For classrooms managing aggression, elopement, disruption. Heavy DRO and replacement behavior reinforcement.',
  'all',
  'externalizing_sdc',
  true,
  '{"display_currency":"points","engagement_points":1,"probe_correct_points":2,"dro_interval_minutes":5,"dro_points":3,"response_cost_enabled":true,"behaviors":[{"name":"Following directions","points":2},{"name":"Transition calmly","points":2},{"name":"Ask for help","points":3},{"name":"Use calm-down strategy","points":3},{"name":"Hands to self","points":2}]}'::jsonb
),
(
  'Internalizing / Anxiety Support',
  'FI-based schedule focused on participation, attempting work, and brave behavior.',
  'all',
  'internalizing',
  true,
  '{"display_currency":"points","engagement_points":2,"probe_correct_points":1,"dro_interval_minutes":10,"dro_points":3,"response_cost_enabled":false,"behaviors":[{"name":"Participated in discussion","points":2},{"name":"Asked a question","points":3},{"name":"Attempted new task","points":2},{"name":"Stayed in area","points":1}]}'::jsonb
),
(
  'PBIS Schoolwide',
  'Points tied to school expectations: Respect, Responsibility, Safety.',
  'all',
  'pbis',
  true,
  '{"display_currency":"points","engagement_points":1,"probe_correct_points":1,"dro_interval_minutes":null,"dro_points":0,"response_cost_enabled":false,"behaviors":[{"name":"Respect","points":2},{"name":"Responsibility","points":2},{"name":"Safety","points":2},{"name":"Kindness","points":1}]}'::jsonb
),
(
  'Middle School XP',
  'Achievement-based XP system for independence and self-management.',
  '6to8',
  'middle_xp',
  true,
  '{"display_currency":"xp","engagement_points":1,"probe_correct_points":2,"dro_interval_minutes":null,"dro_points":0,"response_cost_enabled":true,"behaviors":[{"name":"Assignment completion","points":3},{"name":"Self-monitoring","points":2},{"name":"Peer collaboration","points":2},{"name":"On-time to class","points":1}]}'::jsonb
),
(
  'High School Credits',
  'Responsibility-based credits for autonomy and leadership.',
  '9to12',
  'high_credits',
  true,
  '{"display_currency":"credits","engagement_points":1,"probe_correct_points":2,"dro_interval_minutes":null,"dro_points":0,"response_cost_enabled":true,"behaviors":[{"name":"Work completion","points":3},{"name":"Community contribution","points":2},{"name":"Self-advocacy","points":3},{"name":"Mentored peer","points":2}]}'::jsonb
);
