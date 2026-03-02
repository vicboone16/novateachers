
-- Fix: Drop RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Creators can read their invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Creators can manage their invite codes" ON public.agency_invite_codes;

-- PERMISSIVE SELECT: creators can read their own codes
CREATE POLICY "Creators can read their invite codes"
  ON public.agency_invite_codes FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- PERMISSIVE INSERT/UPDATE/DELETE: creators can manage their own codes
CREATE POLICY "Creators can manage their invite codes"
  ON public.agency_invite_codes FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
