
-- 1) guest_data_entries: remove permissive anon+authenticated INSERT, 
--    replace with authenticated-only + validated INSERT
DROP POLICY IF EXISTS "Anon and authenticated insert guest data" ON public.guest_data_entries;

-- The edge function uses service role (bypasses RLS), so no direct INSERT needed.
-- But keep authenticated INSERT restricted to the creating teacher only.
CREATE POLICY "Authenticated teacher can insert guest data"
  ON public.guest_data_entries FOR INSERT TO authenticated
  WITH CHECK (created_by_teacher = auth.uid());

-- 2) behavior_categories: scope SELECT to creator
DROP POLICY IF EXISTS "Authenticated users can read behavior categories" ON public.behavior_categories;
CREATE POLICY "Users can read own behavior categories"
  ON public.behavior_categories FOR SELECT TO authenticated
  USING (created_by = auth.uid());
