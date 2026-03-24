
-- Classroom settings table for point goals, mission, word of week
CREATE TABLE IF NOT EXISTS public.classroom_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.classroom_groups(group_id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  point_goal integer NOT NULL DEFAULT 500,
  point_goal_label text NOT NULL DEFAULT 'Class Goal',
  mission_text text DEFAULT 'Be Kind, Be Safe, Be Respectful',
  word_of_week text DEFAULT 'Perseverance',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id)
);

ALTER TABLE public.classroom_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open all classroom_settings" ON public.classroom_settings
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
