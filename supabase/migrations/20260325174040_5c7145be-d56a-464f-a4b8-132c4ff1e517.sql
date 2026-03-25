
-- Allow anon to read parent_actions (needed for parent link message thread)
CREATE POLICY "Anon can read parent actions"
ON public.parent_actions
FOR SELECT
TO anon
USING (true);
