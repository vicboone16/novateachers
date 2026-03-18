-- Beacon Points Ledger: records every point transaction
CREATE TABLE public.beacon_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  points integer NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  source_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.beacon_points_ledger ENABLE ROW LEVEL SECURITY;

-- Policies: staff can manage own entries
CREATE POLICY "Staff can insert own point entries"
  ON public.beacon_points_ledger FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff can read own point entries"
  ON public.beacon_points_ledger FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY "Staff can delete own point entries"
  ON public.beacon_points_ledger FOR DELETE TO authenticated
  USING (staff_id = auth.uid());

-- Student balance view
CREATE OR REPLACE VIEW public.v_student_points_balance
WITH (security_invoker = true)
AS
SELECT
  student_id,
  agency_id,
  SUM(points) AS balance,
  COUNT(*) FILTER (WHERE points > 0) AS total_earned_count,
  COALESCE(SUM(points) FILTER (WHERE points > 0), 0) AS total_earned,
  COALESCE(ABS(SUM(points) FILTER (WHERE points < 0)), 0) AS total_spent,
  MAX(created_at) AS last_activity
FROM public.beacon_points_ledger
GROUP BY student_id, agency_id;

-- Index for fast balance lookups
CREATE INDEX idx_beacon_points_student ON public.beacon_points_ledger (student_id, agency_id);
CREATE INDEX idx_beacon_points_staff ON public.beacon_points_ledger (staff_id);
CREATE INDEX idx_beacon_points_created ON public.beacon_points_ledger (created_at DESC);