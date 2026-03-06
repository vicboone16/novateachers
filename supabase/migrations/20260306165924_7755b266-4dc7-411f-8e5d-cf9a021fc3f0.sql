
-- ============================================================
-- Fix 1: Tighten classroom_group_teachers INSERT/DELETE policies
-- Fix 2: Tighten classroom_group_students INSERT/DELETE policies  
-- Fix 3: Enable RLS on invite_codes table
-- ============================================================

-- Drop overly permissive policies on classroom_group_teachers
DROP POLICY IF EXISTS "Authenticated users can manage group teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "Authenticated users can delete group teachers" ON public.classroom_group_teachers;

-- Only the classroom group creator can add/remove teachers
CREATE POLICY "Group creator can add teachers"
  ON public.classroom_group_teachers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_teachers.group_id
        AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Group creator can remove teachers"
  ON public.classroom_group_teachers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_teachers.group_id
        AND g.created_by = auth.uid()
    )
  );

-- Drop overly permissive policies on classroom_group_students
DROP POLICY IF EXISTS "Authenticated users can manage group students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Authenticated users can delete group students" ON public.classroom_group_students;

-- Only the classroom group creator can add/remove students
CREATE POLICY "Group creator can add students"
  ON public.classroom_group_students FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_students.group_id
        AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Group creator can remove students"
  ON public.classroom_group_students FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_students.group_id
        AND g.created_by = auth.uid()
    )
  );

-- Fix 3: Enable RLS on invite_codes and add creator-scoped policy
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can read own invite codes"
  ON public.invite_codes FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Creators can insert invite codes"
  ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update own invite codes"
  ON public.invite_codes FOR UPDATE TO authenticated
  USING (created_by = auth.uid());
