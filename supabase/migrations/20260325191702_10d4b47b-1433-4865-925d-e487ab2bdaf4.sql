
ALTER TABLE public.staff_onboarding ADD COLUMN agency_id uuid;
ALTER TABLE public.staff_onboarding ADD COLUMN onboarding_day integer DEFAULT 1;
ALTER TABLE public.staff_onboarding ADD COLUMN total_actions integer DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS staff_onboarding_user_agency_idx ON public.staff_onboarding(user_id, agency_id);
