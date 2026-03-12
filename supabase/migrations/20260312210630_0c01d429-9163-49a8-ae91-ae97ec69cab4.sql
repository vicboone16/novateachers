
-- 1. Create teacher_weekly_summaries table
CREATE TABLE IF NOT EXISTS public.teacher_weekly_summaries (
  summary_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  behavior_summary jsonb DEFAULT '{}'::jsonb,
  engagement_summary jsonb DEFAULT '{}'::jsonb,
  abc_summary jsonb DEFAULT '{}'::jsonb,
  trigger_summary jsonb DEFAULT '{}'::jsonb,
  probe_summary jsonb DEFAULT '{}'::jsonb,
  duration_summary jsonb DEFAULT '{}'::jsonb,
  reliability_summary jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  sent_to uuid[],
  generated_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(student_id, staff_id, week_start)
);

ALTER TABLE public.teacher_weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own weekly summaries"
  ON public.teacher_weekly_summaries FOR ALL TO authenticated
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_staff_week
  ON public.teacher_weekly_summaries (staff_id, week_start DESC);

-- 2. Upgrade teacher_interval_settings with missing columns
ALTER TABLE public.teacher_interval_settings
  ADD COLUMN IF NOT EXISTS prompts_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS applies_during_blocks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS classroom_group_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
