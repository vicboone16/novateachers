
-- Allow any authenticated user to read classroom groups and teachers (teacher app - all staff need visibility)
DROP POLICY IF EXISTS "Members can view classroom groups" ON public.classroom_groups;
CREATE POLICY "Authenticated users can view classroom groups"
  ON public.classroom_groups FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Members can view group teachers" ON public.classroom_group_teachers;
CREATE POLICY "Authenticated users can view group teachers"
  ON public.classroom_group_teachers FOR SELECT TO authenticated
  USING (true);

-- Also allow any authenticated user to read classroom_group_students
DROP POLICY IF EXISTS "Members can view group students" ON public.classroom_group_students;
CREATE POLICY "Authenticated users can view group students"
  ON public.classroom_group_students FOR SELECT TO authenticated
  USING (true);

-- Allow any authenticated teacher to add themselves to a classroom group
DROP POLICY IF EXISTS "Group creator can add teachers" ON public.classroom_group_teachers;
CREATE POLICY "Authenticated users can add teachers"
  ON public.classroom_group_teachers FOR INSERT TO authenticated
  WITH CHECK (true);
