-- ============================================================
-- Nova Core SQL — SDC Reinforcement Templates & Schedules
-- Adds day-state-aware reinforcement scheduling system
-- Run on the Core Supabase instance
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- A. SDC CLASSROOM REINFORCEMENT TEMPLATES (PRESET LIBRARY)
-- Stores the 4 preset SDC templates with day-state schedules.
-- These are the classroom-level starting points.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.beacon_sdc_reinforcement_templates (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id                   uuid,                    -- null = global preset
  template_name               text NOT NULL,
  support_level               text NOT NULL,           -- 'high_support' | 'moderate_support' | 'behavior_intensive' | 'sensory_autism' | 'custom'
  description                 text,
  use_case_notes              text,

  -- Day-state reinforcement schedules
  red_schedule                text NOT NULL DEFAULT 'FR1',
  yellow_schedule             text NOT NULL DEFAULT 'FR1_FR2',
  green_schedule              text NOT NULL DEFAULT 'FR2_FR3',
  blue_schedule               text NOT NULL DEFAULT 'VR3',

  -- Token goal tiers
  min_token_goal              integer NOT NULL DEFAULT 3,
  standard_token_goal         integer NOT NULL DEFAULT 5,
  stretch_token_goal          integer NOT NULL DEFAULT 8,

  -- Response cost defaults
  response_cost_default_enabled  boolean NOT NULL DEFAULT false,
  response_cost_default_value    integer NOT NULL DEFAULT 1,

  -- Metadata
  is_preset                   boolean NOT NULL DEFAULT true,
  is_active                   boolean NOT NULL DEFAULT true,
  sort_order                  integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beacon_sdc_reinforcement_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read SDC templates"
  ON public.beacon_sdc_reinforcement_templates FOR SELECT TO authenticated
  USING (is_active = true AND (agency_id IS NULL OR agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  )));

CREATE POLICY "Agency admins can manage SDC templates"
  ON public.beacon_sdc_reinforcement_templates FOR ALL TO authenticated
  USING (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ));

-- ──────────────────────────────────────────────────────────────
-- B. CLASSROOM REINFORCEMENT SETTINGS
-- Stores which SDC template a classroom uses + custom overrides.
-- One row per classroom.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.beacon_classroom_reinforcement_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id                text NOT NULL UNIQUE,   -- references classroom group id
  agency_id                   uuid NOT NULL,
  sdc_template_id             uuid REFERENCES public.beacon_sdc_reinforcement_templates(id) ON DELETE SET NULL,

  -- Custom overrides (null = use template default)
  red_schedule_override       text,
  yellow_schedule_override    text,
  green_schedule_override     text,
  blue_schedule_override      text,

  -- Token goal overrides (null = use template default)
  min_token_goal_override     integer,
  standard_token_goal_override integer,
  stretch_token_goal_override integer,

  -- Response cost override (null = use template default)
  response_cost_enabled_override boolean,
  response_cost_value_override   integer,

  -- Token economy enabled for classroom
  token_economy_enabled       boolean NOT NULL DEFAULT true,
  teacher_store_enabled       boolean NOT NULL DEFAULT true,

  assigned_by                 uuid,
  assigned_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beacon_classroom_reinforcement_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read classroom reinforcement settings"
  ON public.beacon_classroom_reinforcement_settings FOR SELECT TO authenticated
  USING (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Staff can manage classroom reinforcement settings"
  ON public.beacon_classroom_reinforcement_settings FOR ALL TO authenticated
  USING (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ))
  WITH CHECK (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ));

-- ──────────────────────────────────────────────────────────────
-- C. STUDENT REINFORCEMENT SCHEDULE OVERRIDES
-- Per-student day-state schedule overrides and token goal.
-- If use_classroom_defaults = true, student inherits classroom settings.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.beacon_student_reinforcement_schedules (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                  uuid NOT NULL UNIQUE,
  agency_id                   uuid NOT NULL,
  classroom_id                text,

  -- Whether to inherit from classroom template
  use_classroom_defaults      boolean NOT NULL DEFAULT true,

  -- Per-state schedule overrides (null = inherit)
  red_schedule_override       text,
  yellow_schedule_override    text,
  green_schedule_override     text,
  blue_schedule_override      text,

  -- Token goal override (null = inherit)
  token_goal_override         integer,

  -- Response cost override (null = inherit)
  response_cost_enabled_override boolean,
  response_cost_value_override   integer,

  -- Earn-only mode (no response cost ever)
  earn_only_mode              boolean NOT NULL DEFAULT false,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beacon_student_reinforcement_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read student reinforcement schedules"
  ON public.beacon_student_reinforcement_schedules FOR SELECT TO authenticated
  USING (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Staff can manage student reinforcement schedules"
  ON public.beacon_student_reinforcement_schedules FOR ALL TO authenticated
  USING (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ))
  WITH CHECK (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ));

-- ──────────────────────────────────────────────────────────────
-- D. STUDENT BEHAVIOR RULES
-- Per-behavior reinforcement control for each student.
-- Controls active/visible, points enabled/value, response cost.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.beacon_student_behavior_rules (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                  uuid NOT NULL,
  agency_id                   uuid NOT NULL,

  -- Behavior identification
  behavior_name               text NOT NULL,
  response_class              text,                   -- e.g. 'escape', 'attention', 'replacement'
  behavior_category           text,                   -- e.g. 'challenging', 'replacement', 'academic'

  -- Visibility & activation
  active                      boolean NOT NULL DEFAULT true,
  teacher_visible             boolean NOT NULL DEFAULT true,

  -- Points configuration
  points_enabled              boolean NOT NULL DEFAULT true,
  point_value                 integer NOT NULL DEFAULT 1,

  -- Response cost configuration
  response_cost_enabled       boolean NOT NULL DEFAULT false,
  response_cost_value         integer NOT NULL DEFAULT 1,

  -- Replacement behavior link
  replacement_behavior_label  text,

  -- Notes
  notes                       text,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, behavior_name)
);

ALTER TABLE public.beacon_student_behavior_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read student behavior rules"
  ON public.beacon_student_behavior_rules FOR SELECT TO authenticated
  USING (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Staff can manage student behavior rules"
  ON public.beacon_student_behavior_rules FOR ALL TO authenticated
  USING (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ))
  WITH CHECK (agency_id IN (
    SELECT agency_id FROM public.agency_staff WHERE user_id = auth.uid()
  ));

-- ──────────────────────────────────────────────────────────────
-- E. EFFECTIVE SETTINGS VIEW
-- Resolves the final reinforcement schedule per student,
-- falling back: student override → classroom settings → SDC template defaults
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_beacon_effective_reinforcement AS
SELECT
  ss.student_id,
  ss.classroom_id,
  ss.use_classroom_defaults,
  ss.earn_only_mode,

  -- Effective red schedule: student override → classroom override → template default → fallback
  COALESCE(
    ss.red_schedule_override,
    cs.red_schedule_override,
    t.red_schedule,
    'FR1'
  ) AS effective_red_schedule,

  -- Effective yellow schedule
  COALESCE(
    ss.yellow_schedule_override,
    cs.yellow_schedule_override,
    t.yellow_schedule,
    'FR1_FR2'
  ) AS effective_yellow_schedule,

  -- Effective green schedule
  COALESCE(
    ss.green_schedule_override,
    cs.green_schedule_override,
    t.green_schedule,
    'FR2_FR3'
  ) AS effective_green_schedule,

  -- Effective blue schedule
  COALESCE(
    ss.blue_schedule_override,
    cs.blue_schedule_override,
    t.blue_schedule,
    'VR3'
  ) AS effective_blue_schedule,

  -- Effective token goal (use standard as the operative goal)
  COALESCE(
    ss.token_goal_override,
    cs.standard_token_goal_override,
    t.standard_token_goal,
    5
  ) AS effective_token_goal,

  COALESCE(t.min_token_goal, 3) AS effective_min_token_goal,
  COALESCE(t.stretch_token_goal, 8) AS effective_stretch_token_goal,

  -- Effective response cost
  COALESCE(
    ss.response_cost_enabled_override,
    cs.response_cost_enabled_override,
    t.response_cost_default_enabled,
    false
  ) AS effective_response_cost_enabled,

  COALESCE(
    ss.response_cost_value_override,
    cs.response_cost_value_override,
    t.response_cost_default_value,
    1
  ) AS effective_response_cost_value,

  -- SDC template name for display
  t.template_name AS sdc_template_name,
  t.support_level AS sdc_support_level

FROM public.beacon_student_reinforcement_schedules ss
LEFT JOIN public.beacon_classroom_reinforcement_settings cs
  ON cs.classroom_id = ss.classroom_id
LEFT JOIN public.beacon_sdc_reinforcement_templates t
  ON t.id = cs.sdc_template_id;

-- ──────────────────────────────────────────────────────────────
-- F. SEED DATA — 4 SDC REINFORCEMENT TEMPLATES (GLOBAL PRESETS)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.beacon_sdc_reinforcement_templates (
  template_name, support_level, description, use_case_notes,
  red_schedule, yellow_schedule, green_schedule, blue_schedule,
  min_token_goal, standard_token_goal, stretch_token_goal,
  response_cost_default_enabled, response_cost_default_value,
  is_preset, sort_order
) VALUES

-- Template 1: High Support / Regulation-First
(
  'SDC High Support',
  'high_support',
  'Regulation-first reinforcement for frequent red/yellow days. Dense schedules, low token goals, and immediate reinforcement access.',
  'Use when: frequent red/yellow days, shutdown or escape behaviors, aggression, low task tolerance, or early learners with fragile instructional stamina.',
  'FR1',        -- red
  'FR1',        -- yellow (FR1 → FR2 as stability improves)
  'FR2',        -- green
  'FR2_VR3',    -- blue
  3, 5, 8,     -- token goals: min / standard / stretch
  false, 1,    -- response cost: off by default
  true, 1
),

-- Template 2: Moderate Support
(
  'SDC Moderate Support',
  'moderate_support',
  'Structured reinforcement for students with moderate behavioral needs and emerging instructional stamina.',
  'Use when: some independence, moderate behavior, instructional time is possible, and students can tolerate slightly delayed reinforcement.',
  'FR1',        -- red
  'FR2',        -- yellow
  'FR2_FR3',    -- green
  'VR3',        -- blue
  5, 8, 10,    -- token goals: min / standard / stretch
  false, 1,    -- response cost: off by default (optional)
  true, 2
),

-- Template 3: Behavior Intensive / ED-Style
(
  'SDC Behavior Intensive',
  'behavior_intensive',
  'Highly individualized reinforcement for students with frequent aggression, elopement, authority conflict, or high behavioral volatility.',
  'Use when: high aggression, authority conflict, elopement, refusal, or disruption. Response cost is toggle-only — off by default for most students.',
  'FR1',        -- red (IMMEDIATE)
  'FR1_FR2',    -- yellow
  'FR2',        -- green
  'FR3',        -- blue (light VR only when stable)
  2, 5, 7,     -- token goals: min / standard / stretch (highly individualized)
  false, 1,    -- response cost: toggle only, off by default
  true, 3
),

-- Template 4: Sensory / Autism SDC
(
  'SDC Sensory & Autism',
  'sensory_autism',
  'Predictable, structured reinforcement for sensory overload, rigidity, and transition difficulties. Response cost is contraindicated.',
  'Use when: sensory overload, rigid behavioral patterns, transition difficulty, lower social flexibility, or high environmental sensitivity.',
  'FR1',        -- red
  'FR1_FR2',    -- yellow
  'FR2',        -- green
  'FR2_VR3',    -- blue (only after demonstrated stability)
  3, 5, 6,     -- token goals: min / standard / stretch (smaller chunks, highly visual)
  false, 1,    -- response cost: OFF (strong clinical rule — often contraindicated)
  true, 4
)

ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- G. INDEXES
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_beacon_classroom_reinforcement_agency
  ON public.beacon_classroom_reinforcement_settings (agency_id);

CREATE INDEX IF NOT EXISTS idx_beacon_student_reinforcement_schedules_agency
  ON public.beacon_student_reinforcement_schedules (agency_id);

CREATE INDEX IF NOT EXISTS idx_beacon_student_behavior_rules_student
  ON public.beacon_student_behavior_rules (student_id, active);

CREATE INDEX IF NOT EXISTS idx_beacon_student_behavior_rules_agency
  ON public.beacon_student_behavior_rules (agency_id);
