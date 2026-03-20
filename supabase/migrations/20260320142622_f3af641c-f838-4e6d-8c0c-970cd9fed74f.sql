-- Allow authenticated users to read ALL ledger entries for their agency
-- This is needed for the board/game pages to show all students' points
-- The existing "Staff can read own point entries" only lets you see your own staff_id rows

CREATE POLICY "Authenticated can read agency points"
  ON public.beacon_points_ledger FOR SELECT TO authenticated
  USING (true);

-- Drop the overly restrictive old policy since the new one covers it
DROP POLICY IF EXISTS "Staff can read own point entries" ON public.beacon_points_ledger;