
-- Add missing columns to teacher_data_events
ALTER TABLE public.teacher_data_events 
  ADD COLUMN IF NOT EXISTS agency_id uuid,
  ADD COLUMN IF NOT EXISTS classroom_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add RLS to teacher_data_events
ALTER TABLE public.teacher_data_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own data events"
  ON public.teacher_data_events FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Users can read own data events"
  ON public.teacher_data_events FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY "Users can delete own data events"
  ON public.teacher_data_events FOR DELETE TO authenticated
  USING (staff_id = auth.uid());

-- Add RLS to teacher_interval_settings
ALTER TABLE public.teacher_interval_settings ENABLE ROW LEVEL SECURITY;

-- Add user_id column for RLS scoping
ALTER TABLE public.teacher_interval_settings
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS agency_id uuid,
  ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_until timestamptz;

CREATE POLICY "Users can manage own interval settings"
  ON public.teacher_interval_settings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for weekly summary queries
CREATE INDEX IF NOT EXISTS idx_teacher_data_events_student_week
  ON public.teacher_data_events (student_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_data_events_type
  ON public.teacher_data_events (event_type, event_subtype);
