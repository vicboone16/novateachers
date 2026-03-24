
-- Create mayday_alerts table on Cloud
CREATE TABLE IF NOT EXISTS public.mayday_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  classroom_id uuid NULL,
  student_id uuid NULL,
  triggered_by uuid NOT NULL,
  alert_type text NOT NULL DEFAULT 'safety',
  urgency text NOT NULL DEFAULT 'high',
  message text NULL,
  status text NOT NULL DEFAULT 'active',
  acknowledged_at timestamptz NULL,
  acknowledged_by uuid NULL,
  resolved_at timestamptz NULL,
  resolved_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mayday_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open all mayday_alerts" ON public.mayday_alerts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create mayday_recipients table on Cloud
CREATE TABLE IF NOT EXISTS public.mayday_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mayday_id uuid NOT NULL REFERENCES public.mayday_alerts(id) ON DELETE CASCADE,
  recipient_user_id uuid NULL,
  contact_id uuid NULL REFERENCES public.mayday_contacts(id),
  delivery_channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  delivered_at timestamptz NULL,
  error_message text NULL,
  delivery_channels_json jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mayday_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open all mayday_recipients" ON public.mayday_recipients
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Enable realtime for mayday_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.mayday_alerts;
