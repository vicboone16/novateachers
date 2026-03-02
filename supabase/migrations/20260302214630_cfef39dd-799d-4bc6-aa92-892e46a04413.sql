-- Fix: Convert RESTRICTIVE policies to PERMISSIVE so creators can actually access their invite codes
DROP POLICY IF EXISTS "Admins can manage invite codes for their agency" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Creators can read their invite codes" ON public.agency_invite_codes;

-- PERMISSIVE SELECT: creators can read their own codes
CREATE POLICY "Creators can read their invite codes"
  ON public.agency_invite_codes FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- PERMISSIVE ALL: creators can manage their own codes
CREATE POLICY "Creators can manage their invite codes"
  ON public.agency_invite_codes FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());