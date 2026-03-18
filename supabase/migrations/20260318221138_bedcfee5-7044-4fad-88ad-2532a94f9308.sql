
-- Student attendance/status tracking
CREATE TABLE public.student_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  group_id uuid REFERENCES public.classroom_groups(group_id) ON DELETE CASCADE NOT NULL,
  agency_id uuid NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'present',
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (student_id, group_id, recorded_date)
);

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read attendance for their classrooms"
  ON public.student_attendance FOR SELECT TO authenticated
  USING (
    recorded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM classroom_group_teachers t
      WHERE t.group_id = student_attendance.group_id AND t.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM classroom_groups g
      WHERE g.group_id = student_attendance.group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Staff can insert attendance"
  ON public.student_attendance FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid());

CREATE POLICY "Staff can update own attendance records"
  ON public.student_attendance FOR UPDATE TO authenticated
  USING (recorded_by = auth.uid());

CREATE POLICY "Staff can delete own attendance records"
  ON public.student_attendance FOR DELETE TO authenticated
  USING (recorded_by = auth.uid());

-- Staff presence/location tracking
CREATE TABLE public.staff_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.classroom_groups(group_id) ON DELETE CASCADE NOT NULL,
  agency_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'in_classroom',
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.staff_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read presence for their classrooms"
  ON public.staff_presence FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM classroom_group_teachers t
      WHERE t.group_id = staff_presence.group_id AND t.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM classroom_groups g
      WHERE g.group_id = staff_presence.group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Staff can manage own presence"
  ON public.staff_presence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update own presence"
  ON public.staff_presence FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can delete own presence"
  ON public.staff_presence FOR DELETE TO authenticated
  USING (user_id = auth.uid());
