-- Enable realtime for staff_presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_presence;

-- Ensure RLS is permissive for staff_presence (matches existing pattern)
ALTER TABLE public.staff_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open read staff_presence" ON public.staff_presence
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Open insert staff_presence" ON public.staff_presence
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Open update staff_presence" ON public.staff_presence
  FOR UPDATE TO anon, authenticated USING (true);

-- Same for staff_presence_history
ALTER TABLE public.staff_presence_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open read staff_presence_history" ON public.staff_presence_history
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Open insert staff_presence_history" ON public.staff_presence_history
  FOR INSERT TO anon, authenticated WITH CHECK (true);