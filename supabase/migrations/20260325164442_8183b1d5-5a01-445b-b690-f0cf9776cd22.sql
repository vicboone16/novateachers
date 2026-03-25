
-- ═══════════════════════════════════════════════════════════
-- 1. PARENT-TEACHER REINFORCEMENT LOOP
-- ═══════════════════════════════════════════════════════════

-- Student-parent links
CREATE TABLE IF NOT EXISTS public.student_parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  parent_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  agency_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, parent_user_id)
);
ALTER TABLE public.student_parent_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read parent links" ON public.student_parent_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert parent links" ON public.student_parent_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update parent links" ON public.student_parent_links FOR UPDATE TO authenticated USING (true);

-- Parent insights
CREATE TABLE IF NOT EXISTS public.parent_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  insight_type TEXT NOT NULL DEFAULT 'win',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT DEFAULT 'positive',
  source TEXT DEFAULT 'system',
  created_by UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.parent_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read parent insights" ON public.parent_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert parent insights" ON public.parent_insights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can read parent insights" ON public.parent_insights FOR SELECT TO anon USING (true);

-- Parent actions
CREATE TABLE IF NOT EXISTS public.parent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  message TEXT,
  parent_user_id UUID,
  parent_name TEXT,
  staff_viewed BOOLEAN DEFAULT false,
  staff_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.parent_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read parent actions" ON public.parent_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert parent actions" ON public.parent_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can insert parent actions" ON public.parent_actions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can update parent actions" ON public.parent_actions FOR UPDATE TO authenticated USING (true);

-- Home reinforcement log
CREATE TABLE IF NOT EXISTS public.home_reinforcement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  activity TEXT NOT NULL,
  notes TEXT,
  parent_user_id UUID,
  parent_name TEXT,
  bonus_points_awarded INTEGER DEFAULT 0,
  staff_acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.home_reinforcement_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read home reinforcement" ON public.home_reinforcement_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert home reinforcement" ON public.home_reinforcement_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can insert home reinforcement" ON public.home_reinforcement_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can update home reinforcement" ON public.home_reinforcement_log FOR UPDATE TO authenticated USING (true);

-- Parent access links (for token-based parent view)
CREATE TABLE IF NOT EXISTS public.parent_access_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.parent_access_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage parent access links" ON public.parent_access_links FOR ALL TO authenticated USING (true);
CREATE POLICY "Anon can read parent access links" ON public.parent_access_links FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can update parent access links" ON public.parent_access_links FOR UPDATE TO anon USING (true);

-- ═══════════════════════════════════════════════════════════
-- 2. ADVANCED QUESTS & MISSIONS
-- ═══════════════════════════════════════════════════════════

-- Classroom quest templates
CREATE TABLE IF NOT EXISTS public.classroom_quest_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  group_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  quest_type TEXT NOT NULL DEFAULT 'daily',
  quest_category TEXT DEFAULT 'points',
  target_value INTEGER DEFAULT 10,
  reward_points INTEGER DEFAULT 5,
  reward_unlock_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.classroom_quest_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage quest templates" ON public.classroom_quest_templates FOR ALL TO authenticated USING (true);

-- Student quests (assigned instances)
CREATE TABLE IF NOT EXISTS public.student_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  template_id UUID REFERENCES public.classroom_quest_templates(id) ON DELETE SET NULL,
  agency_id UUID NOT NULL,
  group_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  quest_type TEXT NOT NULL DEFAULT 'daily',
  quest_category TEXT DEFAULT 'points',
  target_value INTEGER DEFAULT 10,
  current_value INTEGER DEFAULT 0,
  reward_points INTEGER DEFAULT 5,
  reward_unlock_id UUID,
  status TEXT DEFAULT 'active',
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.student_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage student quests" ON public.student_quests FOR ALL TO authenticated USING (true);
CREATE POLICY "Anon can read student quests" ON public.student_quests FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════════
-- 3. STUDENT COSMETIC UNLOCK SYSTEM
-- ═══════════════════════════════════════════════════════════

-- Cosmetic catalog
CREATE TABLE IF NOT EXISTS public.cosmetic_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID,
  category TEXT NOT NULL DEFAULT 'avatar',
  item_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT DEFAULT '✨',
  preview_url TEXT,
  rarity TEXT DEFAULT 'common',
  unlock_method TEXT DEFAULT 'level',
  unlock_threshold INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agency_id, item_key)
);
ALTER TABLE public.cosmetic_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cosmetic catalog" ON public.cosmetic_catalog FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage cosmetics" ON public.cosmetic_catalog FOR ALL TO authenticated USING (true);

-- Student cosmetic unlocks
CREATE TABLE IF NOT EXISTS public.student_cosmetic_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  cosmetic_id UUID REFERENCES public.cosmetic_catalog(id) ON DELETE CASCADE NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  unlock_source TEXT DEFAULT 'level',
  UNIQUE(student_id, cosmetic_id)
);
ALTER TABLE public.student_cosmetic_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage cosmetic unlocks" ON public.student_cosmetic_unlocks FOR ALL TO authenticated USING (true);
CREATE POLICY "Anon can read cosmetic unlocks" ON public.student_cosmetic_unlocks FOR SELECT TO anon USING (true);

-- Student cosmetic loadout (equipped items)
CREATE TABLE IF NOT EXISTS public.student_cosmetic_loadout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  slot TEXT NOT NULL DEFAULT 'avatar',
  cosmetic_id UUID REFERENCES public.cosmetic_catalog(id) ON DELETE CASCADE NOT NULL,
  equipped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, slot)
);
ALTER TABLE public.student_cosmetic_loadout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage loadout" ON public.student_cosmetic_loadout FOR ALL TO authenticated USING (true);
CREATE POLICY "Anon can read loadout" ON public.student_cosmetic_loadout FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════════
-- 4. LAUNCH READINESS DASHBOARD
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.launch_readiness_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  category TEXT NOT NULL,
  check_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  weight INTEGER DEFAULT 1,
  is_complete BOOLEAN DEFAULT false,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agency_id, check_key)
);
ALTER TABLE public.launch_readiness_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage launch checks" ON public.launch_readiness_checks FOR ALL TO authenticated USING (true);

-- View for score
CREATE OR REPLACE VIEW public.v_launch_readiness_score AS
SELECT
  agency_id,
  COUNT(*) AS total_checks,
  SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) AS completed_checks,
  SUM(weight) AS total_weight,
  SUM(CASE WHEN is_complete THEN weight ELSE 0 END) AS completed_weight,
  ROUND(
    (SUM(CASE WHEN is_complete THEN weight ELSE 0 END)::numeric / NULLIF(SUM(weight), 0)::numeric) * 110,
    1
  ) AS score
FROM public.launch_readiness_checks
GROUP BY agency_id;
