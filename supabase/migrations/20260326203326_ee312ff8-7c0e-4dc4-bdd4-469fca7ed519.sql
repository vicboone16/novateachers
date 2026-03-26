
-- Fix RLS policies: add anon role to SELECT policies on tables queried by the Cloud client
-- The app uses a dual-client architecture where auth lives on Nova Core, not Cloud.
-- The Cloud client connects with the anon key, so these tables must allow anon reads.

-- game_tracks: currently authenticated-only
DROP POLICY IF EXISTS "anyone_can_read_game_tracks" ON public.game_tracks;
CREATE POLICY "anyone_can_read_game_tracks" ON public.game_tracks FOR SELECT TO anon, authenticated USING (true);

-- staff_onboarding
DROP POLICY IF EXISTS "staff_onboarding_select" ON public.staff_onboarding;
CREATE POLICY "staff_onboarding_select" ON public.staff_onboarding FOR SELECT TO anon, authenticated USING (true);

-- staff_onboarding insert
DROP POLICY IF EXISTS "staff_onboarding_insert" ON public.staff_onboarding;
CREATE POLICY "staff_onboarding_insert" ON public.staff_onboarding FOR INSERT TO anon, authenticated WITH CHECK (true);

-- staff_onboarding update
DROP POLICY IF EXISTS "staff_onboarding_update" ON public.staff_onboarding;
CREATE POLICY "staff_onboarding_update" ON public.staff_onboarding FOR UPDATE TO anon, authenticated USING (true);

-- staff_activity_log
DROP POLICY IF EXISTS "staff_activity_log_select" ON public.staff_activity_log;
CREATE POLICY "staff_activity_log_select" ON public.staff_activity_log FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_activity_log_insert" ON public.staff_activity_log;
CREATE POLICY "staff_activity_log_insert" ON public.staff_activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);

-- game_events
DROP POLICY IF EXISTS "Authenticated users can read game_events" ON public.game_events;
CREATE POLICY "anyone_can_read_game_events" ON public.game_events FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert game_events" ON public.game_events;
CREATE POLICY "anyone_can_insert_game_events" ON public.game_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- classroom_team_members
DROP POLICY IF EXISTS "Authenticated users can read team members" ON public.classroom_team_members;
CREATE POLICY "anyone_can_read_team_members" ON public.classroom_team_members FOR SELECT TO anon, authenticated USING (true);

-- daily_quests
DROP POLICY IF EXISTS "Authenticated users can read quests" ON public.daily_quests;
CREATE POLICY "anyone_can_read_quests" ON public.daily_quests FOR SELECT TO anon, authenticated USING (true);

-- daily_quest_progress
DROP POLICY IF EXISTS "Authenticated users can read quest progress" ON public.daily_quest_progress;
CREATE POLICY "anyone_can_read_quest_progress" ON public.daily_quest_progress FOR SELECT TO anon, authenticated USING (true);

-- student_game_profiles
DROP POLICY IF EXISTS "Authenticated users can read game profiles" ON public.student_game_profiles;
CREATE POLICY "anyone_can_read_game_profiles" ON public.student_game_profiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert game profiles" ON public.student_game_profiles;
CREATE POLICY "anyone_can_insert_game_profiles" ON public.student_game_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update game profiles" ON public.student_game_profiles;
CREATE POLICY "anyone_can_update_game_profiles" ON public.student_game_profiles FOR UPDATE TO anon, authenticated USING (true);
