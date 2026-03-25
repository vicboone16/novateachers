
ALTER TABLE public.staff_onboarding
DROP CONSTRAINT IF EXISTS staff_onboarding_user_id_fkey;

ALTER TABLE public.staff_activity_log
DROP CONSTRAINT IF EXISTS staff_activity_log_user_id_fkey;
