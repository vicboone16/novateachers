-- ============================================================
-- Classroom Groups Schema for NovaTrack Core
-- Run this SQL in the NovaTrack Core Supabase project
-- ============================================================

-- Classroom groups within an agency
CREATE TABLE public.classroom_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Teachers assigned to classroom groups
CREATE TABLE public.classroom_group_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.classroom_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Students assigned to classroom groups
CREATE TABLE public.classroom_group_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.classroom_groups(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, client_id)
);

-- Indexes
CREATE INDEX idx_classroom_groups_agency ON public.classroom_groups(agency_id);
CREATE INDEX idx_classroom_group_teachers_user ON public.classroom_group_teachers(user_id);
CREATE INDEX idx_classroom_group_teachers_group ON public.classroom_group_teachers(group_id);
CREATE INDEX idx_classroom_group_students_group ON public.classroom_group_students(group_id);
CREATE INDEX idx_classroom_group_students_client ON public.classroom_group_students(client_id);

-- RLS
ALTER TABLE public.classroom_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_group_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_group_students ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see classroom groups in agencies they belong to
CREATE POLICY "Members can view classroom groups"
  ON public.classroom_groups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_memberships
      WHERE agency_memberships.agency_id = classroom_groups.agency_id
        AND agency_memberships.user_id = auth.uid()
    )
  );

-- Policy: Only owner/admin can insert/update/delete classroom groups
CREATE POLICY "Admins can manage classroom groups"
  ON public.classroom_groups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_memberships
      WHERE agency_memberships.agency_id = classroom_groups.agency_id
        AND agency_memberships.user_id = auth.uid()
        AND agency_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_memberships
      WHERE agency_memberships.agency_id = classroom_groups.agency_id
        AND agency_memberships.user_id = auth.uid()
        AND agency_memberships.role IN ('owner', 'admin')
    )
  );

-- Policy: Teachers can see their own group memberships; admins see all in their agency
CREATE POLICY "View classroom group teachers"
  ON public.classroom_group_teachers FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.id = classroom_group_teachers.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Policy: Only admins can manage teacher assignments
CREATE POLICY "Admins can manage group teachers"
  ON public.classroom_group_teachers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.id = classroom_group_teachers.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.id = classroom_group_teachers.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Policy: Teachers can see students in their groups; admins see all
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
      WHERE cg.id = classroom_group_students.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Policy: Only admins can manage student assignments
CREATE POLICY "Admins can manage group students"
  ON public.classroom_group_students FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.id = classroom_group_students.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classroom_groups cg
      JOIN public.agency_memberships am ON am.agency_id = cg.agency_id
      WHERE cg.id = classroom_group_students.group_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );
