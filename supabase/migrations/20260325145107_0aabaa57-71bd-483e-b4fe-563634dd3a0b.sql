
CREATE TABLE public.game_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  classroom_id uuid,
  student_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read game_events"
  ON public.game_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert game_events"
  ON public.game_events FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;
