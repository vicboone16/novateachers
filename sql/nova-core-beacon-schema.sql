-- ============================================================
-- Nova Core SQL — Beacon Classroom Operations + Reinforcement
-- Run on the Core Supabase instance (yboqqmkghwhlhhnsegje)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- A. CLASSROOM OPERATIONS
-- ──────────────────────────────────────────────────────────────

-- Student attendance/location status (one row per student per classroom per day)
CREATE TABLE IF NOT EXISTS public.student_attendance_status (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL,
  classroom_id  uuid NOT NULL,
  agency_id     uuid NOT NULL,
  recorded_by   uuid NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  status        text NOT NULL DEFAULT 'present',
  changed_at    timestamptz NOT NULL DEFAULT now(),
  notes         text,
  UNIQUE (student_id, classroom_id, recorded_date)
);
ALTER TABLE public.student_attendance_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read own classroom attendance"
  ON public.student_attendance_status FOR SELECT TO authenticated
  USING (recorded_by = auth.uid());
CREATE POLICY "Staff can insert attendance"
  ON public.student_attendance_status FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid());
CREATE POLICY "Staff can update own attendance"
  ON public.student_attendance_status FOR UPDATE TO authenticated
  USING (recorded_by = auth.uid());

-- Staff presence/location (one row per user per classroom, upserted)
CREATE TABLE IF NOT EXISTS public.staff_presence_status (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  classroom_id  uuid NOT NULL,
  agency_id     uuid NOT NULL,
  status        text NOT NULL DEFAULT 'in_classroom',
  changed_at    timestamptz NOT NULL DEFAULT now(),
  notes         text,
  UNIQUE (user_id, classroom_id)
);
ALTER TABLE public.staff_presence_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read classroom presence"
  ON public.staff_presence_status FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Staff can manage own presence"
  ON public.staff_presence_status FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff can update own presence"
  ON public.staff_presence_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Classroom presence log (append-only audit trail of status changes)
CREATE TABLE IF NOT EXISTS public.classroom_presence_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL, -- 'student' or 'staff'
  entity_id     uuid NOT NULL,
  classroom_id  uuid NOT NULL,
  agency_id     uuid NOT NULL,
  old_status    text,
  new_status    text NOT NULL,
  changed_by    uuid NOT NULL,
  changed_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classroom_presence_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can insert presence log"
  ON public.classroom_presence_log FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());
CREATE POLICY "Staff can read own presence log"
  ON public.classroom_presence_log FOR SELECT TO authenticated
  USING (changed_by = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- B. REINFORCEMENT (extends existing beacon_points_ledger)
-- ──────────────────────────────────────────────────────────────

-- Reinforcement templates (if not already present — may overlap with Cloud version)
CREATE TABLE IF NOT EXISTS public.reinforcement_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  category      text NOT NULL DEFAULT 'general',
  age_band      text NOT NULL DEFAULT 'all',
  config        jsonb NOT NULL DEFAULT '{}',
  is_preset     boolean NOT NULL DEFAULT false,
  agency_id     uuid,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reinforcement_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read templates"
  ON public.reinforcement_templates FOR SELECT TO authenticated
  USING (is_preset = true OR created_by = auth.uid());
CREATE POLICY "Staff can insert templates"
  ON public.reinforcement_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update own templates"
  ON public.reinforcement_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Student-level reinforcement plans
CREATE TABLE IF NOT EXISTS public.student_reinforcement_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL,
  classroom_id    uuid,
  agency_id       uuid NOT NULL,
  template_id     uuid REFERENCES public.reinforcement_templates(id),
  schedule_type   text NOT NULL DEFAULT 'FI',  -- FI, VI, FR, VR, DRO, DRL, DRA
  schedule_params jsonb NOT NULL DEFAULT '{}',
  target_behavior text,
  replacement_behavior text,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_reinforcement_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read own plans"
  ON public.student_reinforcement_plans FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "Staff can insert plans"
  ON public.student_reinforcement_plans FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update own plans"
  ON public.student_reinforcement_plans FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Token boards (per-student visual progress toward reward)
CREATE TABLE IF NOT EXISTS public.token_boards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL,
  classroom_id    uuid,
  agency_id       uuid NOT NULL,
  target_tokens   integer NOT NULL DEFAULT 5,
  current_tokens  integer NOT NULL DEFAULT 0,
  reward_name     text NOT NULL DEFAULT 'Prize Box',
  reward_points   integer,
  reset_rule      text NOT NULL DEFAULT 'on_redeem',  -- on_redeem, daily, manual
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.token_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read own token boards"
  ON public.token_boards FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "Staff can insert token boards"
  ON public.token_boards FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update own token boards"
  ON public.token_boards FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Reward catalog
CREATE TABLE IF NOT EXISTS public.beacon_rewards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  cost_points   integer NOT NULL DEFAULT 10,
  category      text NOT NULL DEFAULT 'classroom',  -- classroom, schoolwide, sponsored
  image_url     text,
  agency_id     uuid,
  classroom_id  uuid,
  is_active     boolean NOT NULL DEFAULT true,
  sponsor_name  text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beacon_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read rewards"
  ON public.beacon_rewards FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can insert rewards"
  ON public.beacon_rewards FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update own rewards"
  ON public.beacon_rewards FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Reward redemptions
CREATE TABLE IF NOT EXISTS public.beacon_reward_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL,
  reward_id     uuid REFERENCES public.beacon_rewards(id),
  points_spent  integer NOT NULL,
  staff_id      uuid NOT NULL,
  agency_id     uuid NOT NULL,
  redeemed_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beacon_reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read own redemptions"
  ON public.beacon_reward_redemptions FOR SELECT TO authenticated
  USING (staff_id = auth.uid());
CREATE POLICY "Staff can insert redemptions"
  ON public.beacon_reward_redemptions FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- C. PARENT COMMUNICATION
-- ──────────────────────────────────────────────────────────────

-- Parent contact info
CREATE TABLE IF NOT EXISTS public.parent_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL,
  agency_id     uuid NOT NULL,
  parent_name   text NOT NULL,
  phone         text,
  email         text,
  preferred_channel text NOT NULL DEFAULT 'email',  -- email, sms, both
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read own contacts"
  ON public.parent_contacts FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "Staff can insert contacts"
  ON public.parent_contacts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update own contacts"
  ON public.parent_contacts FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Student-guardian mapping
CREATE TABLE IF NOT EXISTS public.student_guardians (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL,
  contact_id    uuid REFERENCES public.parent_contacts(id) ON DELETE CASCADE,
  relationship  text NOT NULL DEFAULT 'parent',  -- parent, guardian, grandparent, other
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read guardians"
  ON public.student_guardians FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can insert guardians"
  ON public.student_guardians FOR INSERT TO authenticated
  WITH CHECK (true);

-- Parent report profiles (what content to include)
CREATE TABLE IF NOT EXISTS public.parent_report_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL,
  agency_id       uuid NOT NULL,
  include_points  boolean NOT NULL DEFAULT true,
  include_behavior boolean NOT NULL DEFAULT true,
  include_engagement boolean NOT NULL DEFAULT true,
  include_teacher_note boolean NOT NULL DEFAULT true,
  include_charts  boolean NOT NULL DEFAULT false,
  detail_level    text NOT NULL DEFAULT 'summary',  -- summary, detailed
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_report_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage own profiles"
  ON public.parent_report_profiles FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Parent report profile rules (configurable content toggles)
CREATE TABLE IF NOT EXISTS public.parent_report_profile_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid REFERENCES public.parent_report_profiles(id) ON DELETE CASCADE,
  rule_key        text NOT NULL,
  rule_value      jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_report_profile_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage rules via profile"
  ON public.parent_report_profile_rules FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parent_report_profiles p
    WHERE p.id = parent_report_profile_rules.profile_id AND p.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.parent_report_profiles p
    WHERE p.id = parent_report_profile_rules.profile_id AND p.created_by = auth.uid()
  ));

-- Daily student snapshots
CREATE TABLE IF NOT EXISTS public.daily_student_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL,
  agency_id       uuid NOT NULL,
  snapshot_date   date NOT NULL DEFAULT CURRENT_DATE,
  points_earned   integer DEFAULT 0,
  rewards_redeemed integer DEFAULT 0,
  behavior_counts jsonb DEFAULT '{}',
  engagement_pct  numeric(5,2),
  teacher_note    text,
  highlight       text,
  generated_by    uuid NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, agency_id, snapshot_date)
);
ALTER TABLE public.daily_student_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage own snapshots"
  ON public.daily_student_snapshots FOR ALL TO authenticated
  USING (generated_by = auth.uid())
  WITH CHECK (generated_by = auth.uid());

-- Weekly student reports
CREATE TABLE IF NOT EXISTS public.weekly_student_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL,
  agency_id       uuid NOT NULL,
  week_start      date NOT NULL,
  week_end        date NOT NULL,
  total_points    integer DEFAULT 0,
  streaks         jsonb DEFAULT '{}',
  teacher_summary text,
  trend_snapshot  jsonb DEFAULT '{}',
  next_week_focus text,
  generated_by    uuid NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  UNIQUE (student_id, agency_id, week_start)
);
ALTER TABLE public.weekly_student_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage own reports"
  ON public.weekly_student_reports FOR ALL TO authenticated
  USING (generated_by = auth.uid())
  WITH CHECK (generated_by = auth.uid());

-- Secure snapshot tokens (for parent link access)
CREATE TABLE IF NOT EXISTS public.snapshot_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id     uuid NOT NULL,  -- references daily_student_snapshots or weekly_student_reports
  snapshot_type   text NOT NULL DEFAULT 'daily',  -- daily, weekly
  token           text NOT NULL UNIQUE,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.snapshot_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tokens readable by all for public access"
  ON public.snapshot_tokens FOR SELECT TO anon, authenticated
  USING (expires_at > now());

-- Parent notifications log
CREATE TABLE IF NOT EXISTS public.parent_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      uuid REFERENCES public.parent_contacts(id),
  student_id      uuid NOT NULL,
  channel         text NOT NULL DEFAULT 'email',  -- email, sms
  subject         text,
  body            text,
  snapshot_token  text,
  status          text NOT NULL DEFAULT 'pending',  -- pending, sent, failed
  sent_at         timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read own notifications"
  ON public.parent_notifications FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can insert notifications"
  ON public.parent_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- D. MAYDAY / SUPPORT ALERTS
-- ──────────────────────────────────────────────────────────────

-- Mayday alerts
CREATE TABLE IF NOT EXISTS public.mayday_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id    uuid NOT NULL,
  agency_id       uuid NOT NULL,
  triggered_by    uuid NOT NULL,
  student_id      uuid,
  location        text,
  urgency         text NOT NULL DEFAULT 'high',  -- low, medium, high, critical
  note            text,
  status          text NOT NULL DEFAULT 'active',  -- active, acknowledged, resolved
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mayday_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read agency alerts"
  ON public.mayday_alerts FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can trigger alerts"
  ON public.mayday_alerts FOR INSERT TO authenticated
  WITH CHECK (triggered_by = auth.uid());
CREATE POLICY "Staff can update alerts"
  ON public.mayday_alerts FOR UPDATE TO authenticated
  USING (true);

-- Mayday recipient groups
CREATE TABLE IF NOT EXISTS public.mayday_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id    uuid NOT NULL,
  agency_id       uuid NOT NULL,
  user_id         uuid NOT NULL,
  alert_channel   text NOT NULL DEFAULT 'in_app',  -- in_app, web_push, sms
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mayday_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read recipients"
  ON public.mayday_recipients FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can manage recipients"
  ON public.mayday_recipients FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update recipients"
  ON public.mayday_recipients FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- REALTIME: Enable for live updates
-- ──────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_attendance_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_presence_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mayday_alerts;

-- Schema cache reload
SELECT pg_notify('pgrst', 'reload schema');
