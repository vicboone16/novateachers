
-- Guest access codes for substitute teachers (no account required)
CREATE TABLE public.guest_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  group_id UUID NOT NULL,
  agency_id TEXT NOT NULL,
  created_by UUID NOT NULL,
  guest_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions JSONB NOT NULL DEFAULT '{"can_collect_data": true, "can_view_notes": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only creators can manage their codes
ALTER TABLE public.guest_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators manage guest codes"
  ON public.guest_access_codes
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Guest data entries: stores data collected by guests via edge function
CREATE TABLE public.guest_data_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_code_id UUID NOT NULL REFERENCES public.guest_access_codes(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  group_id UUID NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'tally',
  behavior_name TEXT,
  value NUMERIC DEFAULT 1,
  notes TEXT,
  guest_name TEXT,
  created_by_teacher UUID NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_data_entries ENABLE ROW LEVEL SECURITY;

-- Teachers can read guest data for their codes
CREATE POLICY "Teachers read guest data"
  ON public.guest_data_entries
  FOR SELECT
  TO authenticated
  USING (created_by_teacher = auth.uid());
