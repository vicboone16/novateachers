-- ============================================================
-- FIX: Classroom Group RLS policies on NovaTrack Core
-- Run this SQL in the NovaTrack Core Supabase project
-- 
-- Core uses group_id (not id) as PK on classroom_groups.
-- ============================================================

-- Drop existing broken policies on child tables
DROP POLICY IF EXISTS "View classroom group teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "Admins can manage group teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "View classroom group students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Admins can manage group students" ON public.classroom_group_students;

-- Teachers: any authenticated user in the same agency can see teacher assignments
CREATE POLICY "View classroom group teachers"
  ON public.classroom_group_teachers FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.group_id = classroom_group_teachers.group_id
        AND am.user_id = auth.uid()
    )
  );

-- Admins can insert teacher assignments
CREATE POLICY "Admins can manage group teachers"
  ON public.classroom_group_teachers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.group_id = classroom_group_teachers.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete group teachers"
  ON public.classroom_group_teachers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.group_id = classroom_group_teachers.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Students: teachers in the group or admins can see
CREATE POLICY "View classroom group students"
  ON public.classroom_group_students FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_group_teachers cgt
      WHERE cgt.group_id = classroom_group_students.group_id
        AND cgt.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.group_id = classroom_group_students.group_id
        AND am.user_id = auth.uid()
    )
  );

-- Admins can insert student assignments
CREATE POLICY "Admins can manage group students"
  ON public.classroom_group_students FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.group_id = classroom_group_students.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete group students"
  ON public.classroom_group_students FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.group_id = classroom_group_students.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );
