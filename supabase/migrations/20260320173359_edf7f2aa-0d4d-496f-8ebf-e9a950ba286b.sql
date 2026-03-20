
-- Fix classroom_group_students SELECT to include anon
DROP POLICY IF EXISTS "Authenticated users can view group students" ON public.classroom_group_students;
CREATE POLICY "Open read classroom_group_students"
  ON public.classroom_group_students FOR SELECT
  TO anon, authenticated USING (true);

-- Fix classroom_group_teachers SELECT to include anon
DROP POLICY IF EXISTS "Authenticated users can view group teachers" ON public.classroom_group_teachers;
CREATE POLICY "Open read classroom_group_teachers"
  ON public.classroom_group_teachers FOR SELECT
  TO anon, authenticated USING (true);

-- Fix classroom_group_teachers INSERT to include anon
DROP POLICY IF EXISTS "Authenticated users can add teachers" ON public.classroom_group_teachers;
CREATE POLICY "Open insert classroom_group_teachers"
  ON public.classroom_group_teachers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
