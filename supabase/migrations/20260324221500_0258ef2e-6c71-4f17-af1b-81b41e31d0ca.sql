
-- Student attendance status (was incorrectly querying Nova Core)
CREATE TABLE public.student_attendance_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  classroom_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'present',
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, classroom_id, recorded_date)
);

ALTER TABLE public.student_attendance_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open all student_attendance_status" ON public.student_attendance_status
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Student presence tracking (was querying Nova Core view)
CREATE TABLE public.student_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  classroom_group_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  location_type text NOT NULL DEFAULT 'classroom',
  location_label text,
  status text NOT NULL DEFAULT 'present',
  assigned_staff_id uuid,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, classroom_group_id)
);

ALTER TABLE public.student_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open all student_presence" ON public.student_presence
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Classroom board settings (was querying Nova Core)
CREATE TABLE public.classroom_board_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL UNIQUE,
  agency_id uuid,
  mission_text text,
  word_of_week text,
  class_goal_label text DEFAULT 'Class Goal',
  class_goal_target integer DEFAULT 500,
  class_goal_current integer DEFAULT 0,
  theme_slug text DEFAULT 'default',
  show_leaderboard boolean DEFAULT true,
  show_token_boards boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_board_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open all classroom_board_settings" ON public.classroom_board_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- View for student presence (replaces Nova Core v_classroom_student_presence)
CREATE OR REPLACE VIEW public.v_classroom_student_presence
WITH (security_invoker = true) AS
SELECT
  sp.student_id,
  sp.classroom_group_id,
  sp.location_type,
  sp.location_label,
  sp.status,
  sp.assigned_staff_id,
  sp.updated_at
FROM public.student_presence sp;
