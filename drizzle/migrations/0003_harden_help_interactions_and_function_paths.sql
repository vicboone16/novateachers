ALTER TABLE public.help_interactions ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION public.generate_beacon_teacher_plan(uuid, date, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.touch_staff_onboarding_updated_at() SET search_path = public;