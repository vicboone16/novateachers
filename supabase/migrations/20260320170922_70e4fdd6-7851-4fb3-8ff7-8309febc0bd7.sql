
-- Fix classroom_groups RLS: auth is handled by Nova Core, not Lovable Cloud auth
-- So auth.uid() is always null on Cloud. We need permissive policies for authenticated+anon.

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can create classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Creator can update classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Creator can delete classroom groups" ON public.classroom_groups;

-- Recreate with permissive policies (auth gated at app level via Nova Core)
CREATE POLICY "Anyone can create classroom groups"
ON public.classroom_groups
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update classroom groups"
ON public.classroom_groups
FOR UPDATE
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can delete classroom groups"
ON public.classroom_groups
FOR DELETE
TO anon, authenticated
USING (true);
