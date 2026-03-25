
-- Fix staff_onboarding RLS: users auth via Nova Core, not local auth
-- Match the pattern used by staff_presence (open for authenticated)
DROP POLICY IF EXISTS "staff_onboarding_select_own" ON public.staff_onboarding;
DROP POLICY IF EXISTS "staff_onboarding_insert_own" ON public.staff_onboarding;
DROP POLICY IF EXISTS "staff_onboarding_update_own" ON public.staff_onboarding;
DROP POLICY IF EXISTS "staff_onboarding_admin_select" ON public.staff_onboarding;

CREATE POLICY "staff_onboarding_select" ON public.staff_onboarding FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_onboarding_insert" ON public.staff_onboarding FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff_onboarding_update" ON public.staff_onboarding FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Fix staff_activity_log RLS
DROP POLICY IF EXISTS "staff_activity_log_select_own" ON public.staff_activity_log;
DROP POLICY IF EXISTS "staff_activity_log_insert_own" ON public.staff_activity_log;
DROP POLICY IF EXISTS "staff_activity_log_admin_select" ON public.staff_activity_log;

CREATE POLICY "staff_activity_log_select" ON public.staff_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_activity_log_insert" ON public.staff_activity_log FOR INSERT TO authenticated WITH CHECK (true);
