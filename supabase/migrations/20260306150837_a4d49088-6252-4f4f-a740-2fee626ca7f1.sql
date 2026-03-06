
-- Classroom groups within an agency
CREATE TABLE public.classroom_groups (
  group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  name text NOT NULL,
  grade_band text,
  school_name text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Teachers assigned to classroom groups
CREATE TABLE public.classroom_group_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.classroom_groups(group_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Students assigned to classroom groups
CREATE TABLE public.classroom_group_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.classroom_groups(group_id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  agency_id uuid,
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

-- Policies for classroom_groups
CREATE POLICY "Authenticated users can view classroom groups"
  ON public.classroom_groups FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert classroom groups"
  ON public.classroom_groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update classroom groups"
  ON public.classroom_groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Creators can delete classroom groups"
  ON public.classroom_groups FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Policies for classroom_group_teachers
CREATE POLICY "Authenticated users can view group teachers"
  ON public.classroom_group_teachers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage group teachers"
  ON public.classroom_group_teachers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete group teachers"
  ON public.classroom_group_teachers FOR DELETE TO authenticated
  USING (true);

-- Policies for classroom_group_students
CREATE POLICY "Authenticated users can view group students"
  ON public.classroom_group_students FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage group students"
  ON public.classroom_group_students FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete group students"
  ON public.classroom_group_students FOR DELETE TO authenticated
  USING (true);
