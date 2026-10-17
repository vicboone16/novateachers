ALTER FUNCTION public.generate_beacon_teacher_plan(uuid,date,text,text,text,text) SET search_path = public;
ALTER FUNCTION public.touch_staff_onboarding_updated_at() SET search_path = public;

-- Help history has no current frontend consumer. Keep private history
-- server-only until staff identity can be verified in this database.
ALTER TABLE public.help_interactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.help_interactions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.help_interactions TO service_role;