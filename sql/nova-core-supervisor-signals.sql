-- ============================================================
-- Nova Core: Supervisor Signals table + create_supervisor_signal RPC
-- Run this on the Nova Core Supabase instance (yboqqmkghwhlhhnsegje)
-- ============================================================

-- 1. Create the supervisor_signals table
CREATE TABLE IF NOT EXISTS public.supervisor_signals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL,
  agency_id     uuid NOT NULL,
  classroom_id  uuid,
  signal_type   text NOT NULL,          -- 'incident' | 'escalation' | 'pattern' | 'safety_concern' | 'other'
  severity      text NOT NULL DEFAULT 'watch',  -- 'watch' | 'action' | 'critical'
  title         text NOT NULL,
  message       text NOT NULL,
  drivers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  source        jsonb NOT NULL DEFAULT '{"app":"beacon"}'::jsonb,
  acknowledged  boolean NOT NULL DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid DEFAULT auth.uid()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_signals_client      ON public.supervisor_signals (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_agency      ON public.supervisor_signals (agency_id, acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_created_by   ON public.supervisor_signals (created_by, acknowledged);
CREATE INDEX IF NOT EXISTS idx_signals_severity     ON public.supervisor_signals (severity, created_at DESC);

-- RLS
ALTER TABLE public.supervisor_signals ENABLE ROW LEVEL SECURITY;

-- Teachers can read signals they created
CREATE POLICY "Users can read own signals"
  ON public.supervisor_signals FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Teachers can insert signals
CREATE POLICY "Authenticated users can create signals"
  ON public.supervisor_signals FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Supervisors can read all signals for their agency (add after supervisor role setup)
-- CREATE POLICY "Supervisors can read agency signals" ...

-- Allow acknowledgment updates
CREATE POLICY "Users can acknowledge signals"
  ON public.supervisor_signals FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. create_supervisor_signal RPC
CREATE OR REPLACE FUNCTION public.create_supervisor_signal(
  p_client_id    uuid,
  p_signal_type  text,
  p_title        text,
  p_message      text,
  p_severity     text DEFAULT 'watch',
  p_agency_id    uuid DEFAULT NULL,
  p_classroom_id uuid DEFAULT NULL,
  p_drivers      jsonb DEFAULT '{}'::jsonb,
  p_source       jsonb DEFAULT '{"app":"beacon"}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Validate severity
  IF p_severity NOT IN ('watch', 'action', 'critical') THEN
    RAISE EXCEPTION 'Invalid severity: %. Must be watch, action, or critical', p_severity;
  END IF;

  -- Validate signal_type
  IF p_signal_type NOT IN ('incident', 'escalation', 'pattern', 'safety_concern', 'other') THEN
    RAISE EXCEPTION 'Invalid signal_type: %', p_signal_type;
  END IF;

  INSERT INTO public.supervisor_signals (
    client_id, agency_id, classroom_id,
    signal_type, severity, title, message,
    drivers, source, created_by
  ) VALUES (
    p_client_id, p_agency_id, p_classroom_id,
    p_signal_type, p_severity, p_title, p_message,
    p_drivers, p_source, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Enable realtime for live signal feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.supervisor_signals;
