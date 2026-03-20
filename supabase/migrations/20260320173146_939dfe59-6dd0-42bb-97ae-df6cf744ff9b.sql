
-- Fix classroom_groups SELECT policies to allow reading all groups
DROP POLICY IF EXISTS "Authenticated users can view classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Anyone can read classroom by board_slug" ON public.classroom_groups;

CREATE POLICY "Open read classroom_groups"
  ON public.classroom_groups
  FOR SELECT
  TO anon, authenticated
  USING (true);
