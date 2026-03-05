-- ============================================================
-- Nova Core: Event Stream table + insert_event RPC
-- Run this on the Nova Core Supabase instance (yboqqmkghwhlhhnsegje)
-- ============================================================

-- 1. Create the event_stream table (behavior_intelligence schema optional — using public for simplicity)
CREATE TABLE IF NOT EXISTS public.event_stream (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL,
  agency_id     uuid NOT NULL,
  classroom_id  uuid,
  event_type    text NOT NULL,          -- 'behavior' | 'incident' | 'ai' | 'context' | 'prompt' | 'skill_trial' | 'reinforcement'
  event_name    text NOT NULL,
  value         numeric,
  intensity     smallint,
  phase         text,
  prompt_code   text,
  correctness   text,                   -- '+' or '-'
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_app    text NOT NULL DEFAULT 'beacon',
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid DEFAULT auth.uid()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_event_stream_client   ON public.event_stream (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_stream_agency   ON public.event_stream (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_stream_type     ON public.event_stream (event_type, event_name);

-- RLS
ALTER TABLE public.event_stream ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert events"
  ON public.event_stream FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated users can read own events"
  ON public.event_stream FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Allow agency-wide reads for supervisors (add supervisor policy later)
-- CREATE POLICY "Supervisors can read agency events" ...

-- 2. insert_event RPC
CREATE OR REPLACE FUNCTION public.insert_event(
  p_client_id    uuid,
  p_event_type   text,
  p_event_name   text,
  p_agency_id    uuid,
  p_classroom_id uuid DEFAULT NULL,
  p_value        numeric DEFAULT NULL,
  p_intensity    smallint DEFAULT NULL,
  p_phase        text DEFAULT NULL,
  p_prompt_code  text DEFAULT NULL,
  p_correctness  text DEFAULT NULL,
  p_metadata     jsonb DEFAULT '{}'::jsonb,
  p_source_app   text DEFAULT 'beacon'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.event_stream (
    client_id, agency_id, classroom_id,
    event_type, event_name,
    value, intensity, phase, prompt_code, correctness,
    metadata, source_app, created_by
  ) VALUES (
    p_client_id, p_agency_id, p_classroom_id,
    p_event_type, p_event_name,
    p_value, p_intensity, p_phase, p_prompt_code, p_correctness,
    p_metadata, p_source_app, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Enable realtime for dashboards
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_stream;
