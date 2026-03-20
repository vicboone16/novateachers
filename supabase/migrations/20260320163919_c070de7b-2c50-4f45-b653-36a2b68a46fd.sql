
-- Mayday contacts table: supports both system users and external people
CREATE TABLE public.mayday_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  -- If the person is a system user, link them
  user_id uuid DEFAULT NULL,
  -- External contact info (works even without a user account)
  contact_name text NOT NULL,
  email text DEFAULT NULL,
  phone text DEFAULT NULL,
  role_label text DEFAULT 'staff',
  -- Notification preferences
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT false,
  notify_in_app boolean NOT NULL DEFAULT true,
  -- Opt-out days (0=Sun, 1=Mon, ... 6=Sat) — contact won't be notified on these days
  opt_out_days integer[] DEFAULT '{}',
  -- Admin can override opt-out
  admin_override boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mayday_contacts ENABLE ROW LEVEL SECURITY;

-- Agency members can read all contacts for their agency
CREATE POLICY "Authenticated can read mayday contacts"
  ON public.mayday_contacts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert mayday contacts"
  ON public.mayday_contacts FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update mayday contacts"
  ON public.mayday_contacts FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete mayday contacts"
  ON public.mayday_contacts FOR DELETE TO authenticated
  USING (true);
