
-- Add display_name_override to student_game_profiles
ALTER TABLE public.student_game_profiles
ADD COLUMN IF NOT EXISTS display_name_override text DEFAULT NULL;

-- Ensure anon can INSERT/UPDATE student_streaks (fixes red error toast)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_streaks' AND policyname = 'anon_insert_student_streaks') THEN
    CREATE POLICY "anon_insert_student_streaks" ON public.student_streaks FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_streaks' AND policyname = 'anon_update_student_streaks') THEN
    CREATE POLICY "anon_update_student_streaks" ON public.student_streaks FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_streaks' AND policyname = 'anon_select_student_streaks') THEN
    CREATE POLICY "anon_select_student_streaks" ON public.student_streaks FOR SELECT TO anon USING (true);
  END IF;
END $$;
