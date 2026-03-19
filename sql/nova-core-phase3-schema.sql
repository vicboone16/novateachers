-- ══════════════════════════════════════════════════════════════════════
-- Nova Core — Phase 3 Schema
-- Run on the CORE Supabase instance (yboqqmkghwhlhhnsegje)
-- ══════════════════════════════════════════════════════════════════════

-- ── District / School Controls ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supervisor_visibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  supervisor_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'classroom',  -- 'classroom','school','district'
  scope_id uuid,  -- classroom_id, school_id, or null for all
  can_view_data boolean NOT NULL DEFAULT true,
  can_view_points boolean NOT NULL DEFAULT true,
  can_view_attendance boolean NOT NULL DEFAULT true,
  can_view_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, scope, scope_id)
);
ALTER TABLE public.supervisor_visibility_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors can read own rules" ON public.supervisor_visibility_rules FOR SELECT TO authenticated USING (supervisor_id = auth.uid());
CREATE POLICY "Admins can manage visibility rules" ON public.supervisor_visibility_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.district_visibility_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  district_id uuid,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, setting_key)
);
ALTER TABLE public.district_visibility_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read district settings" ON public.district_visibility_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage district settings" ON public.district_visibility_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Sponsor Rewards & Wishlists ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read sponsors" ON public.sponsors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage sponsors" ON public.sponsors FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.sponsored_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  point_cost integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'tangible',
  emoji text NOT NULL DEFAULT '🎁',
  stock integer,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsored_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read sponsored rewards" ON public.sponsored_rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage sponsored rewards" ON public.sponsored_rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.classroom_wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  item_name text NOT NULL,
  description text,
  estimated_cost numeric,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  fulfilled_by uuid,
  fulfilled_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classroom_wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read wishlists" ON public.classroom_wishlists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage wishlists" ON public.classroom_wishlists FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.sponsor_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  wishlist_id uuid REFERENCES public.classroom_wishlists(id) ON DELETE SET NULL,
  reward_id uuid REFERENCES public.sponsored_rewards(id) ON DELETE SET NULL,
  contribution_type text NOT NULL DEFAULT 'reward',
  value numeric,
  notes text,
  contributed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsor_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read contributions" ON public.sponsor_contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert contributions" ON public.sponsor_contributions FOR INSERT TO authenticated WITH CHECK (true);

-- View: v_sponsored_rewards (active rewards with sponsor info)
CREATE OR REPLACE VIEW public.v_sponsored_rewards AS
SELECT
  sr.*,
  s.name AS sponsor_name,
  s.logo_url AS sponsor_logo_url
FROM public.sponsored_rewards sr
JOIN public.sponsors s ON sr.sponsor_id = s.id
WHERE sr.is_active = true AND s.is_active = true;

-- ── Parent Questions / Replies ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.parent_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  student_id uuid NOT NULL,
  snapshot_id uuid,
  parent_contact_id uuid,
  question_text text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
ALTER TABLE public.parent_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read parent questions" ON public.parent_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert questions" ON public.parent_questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update questions" ON public.parent_questions FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.parent_question_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.parent_questions(id) ON DELETE CASCADE,
  author_id uuid,
  author_type text NOT NULL DEFAULT 'staff',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_question_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read replies" ON public.parent_question_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert replies" ON public.parent_question_replies FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.parent_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.parent_questions(id) ON DELETE CASCADE,
  snapshot_id uuid,
  reaction_type text NOT NULL DEFAULT 'thumbs_up',
  parent_contact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(question_id, parent_contact_id)
);
ALTER TABLE public.parent_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reactions" ON public.parent_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert reactions" ON public.parent_reactions FOR INSERT TO authenticated WITH CHECK (true);

-- View: v_parent_questions_open
CREATE OR REPLACE VIEW public.v_parent_questions_open AS
SELECT
  pq.*,
  (SELECT count(*) FROM public.parent_question_replies r WHERE r.question_id = pq.id) AS reply_count,
  (SELECT count(*) FROM public.parent_reactions pr WHERE pr.question_id = pq.id) AS reaction_count
FROM public.parent_questions pq
WHERE pq.status = 'open';

-- ── Student Portal ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_portal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE,
  agency_id uuid NOT NULL,
  display_name text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '😊',
  pin_hash text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_portal_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage portal accounts" ON public.student_portal_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.student_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.student_portal_accounts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage portal tokens" ON public.student_portal_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.student_reward_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  reward_id uuid,
  reward_name text NOT NULL,
  reward_emoji text NOT NULL DEFAULT '🎯',
  target_points integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  achieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_reward_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage reward goals" ON public.student_reward_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- View: v_student_reward_progress
CREATE OR REPLACE VIEW public.v_student_reward_progress AS
SELECT
  srg.*,
  COALESCE(bal.balance, 0) AS current_points,
  CASE
    WHEN srg.target_points > 0 THEN LEAST(100, ROUND((COALESCE(bal.balance, 0)::numeric / srg.target_points) * 100))
    ELSE 0
  END AS progress_pct
FROM public.student_reward_goals srg
LEFT JOIN (
  SELECT student_id, SUM(points) AS balance
  FROM public.beacon_points_ledger
  GROUP BY student_id
) bal ON bal.student_id = srg.student_id
WHERE srg.is_active = true;

-- ── Realtime ────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_question_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_reward_goals;

-- ══════════════════════════════════════════════════════════════════════
-- END Phase 3 Schema
-- ══════════════════════════════════════════════════════════════════════
