
-- Fix: Recreate policies as PERMISSIVE (previous migration created them as RESTRICTIVE)
DROP POLICY IF EXISTS "Creators can read their invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Creators can manage their invite codes" ON public.agency_invite_codes;

-- Permissive SELECT policy
CREATE POLICY "Creators can read their invite codes"
  ON public.agency_invite_codes FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Permissive ALL policy  
CREATE POLICY "Creators can manage their invite codes"
  ON public.agency_invite_codes FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
