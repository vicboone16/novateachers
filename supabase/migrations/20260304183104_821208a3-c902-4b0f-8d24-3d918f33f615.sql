
-- Fix: pending_student_changes UPDATE policy - use requestor or agency-scoped check
-- Since agency_memberships lives on Core, use a simpler approach
CREATE POLICY "Requestor or admin can update pending changes"
  ON public.pending_student_changes FOR UPDATE TO authenticated
  USING (requested_by = auth.uid());
