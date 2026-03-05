
-- Drop overly permissive behavior_categories policies
DROP POLICY "Users can insert behavior categories" ON public.behavior_categories;
DROP POLICY "Users can read behavior categories" ON public.behavior_categories;
DROP POLICY "Users can update behavior categories" ON public.behavior_categories;
DROP POLICY "Users can delete behavior categories" ON public.behavior_categories;

-- Add a created_by column for proper RLS
ALTER TABLE public.behavior_categories ADD COLUMN created_by UUID DEFAULT auth.uid();

-- Recreate with proper scoping - any authenticated user can read, but only creator can modify
CREATE POLICY "Authenticated users can read behavior categories" ON public.behavior_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own behavior categories" ON public.behavior_categories
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own behavior categories" ON public.behavior_categories
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Users can delete own behavior categories" ON public.behavior_categories
  FOR DELETE TO authenticated USING (created_by = auth.uid());
