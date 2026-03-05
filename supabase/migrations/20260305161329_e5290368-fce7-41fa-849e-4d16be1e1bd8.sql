
-- ABC Logs table for Trigger Tracker
CREATE TABLE public.abc_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  user_id UUID NOT NULL,
  antecedent TEXT NOT NULL,
  behavior TEXT NOT NULL,
  consequence TEXT NOT NULL,
  behavior_category TEXT,
  intensity INTEGER DEFAULT 3,
  duration_seconds INTEGER,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.abc_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own abc logs" ON public.abc_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own abc logs" ON public.abc_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own abc logs" ON public.abc_logs
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own abc logs" ON public.abc_logs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Behavior Categories table for Trigger Tracker
CREATE TABLE public.behavior_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  triggers TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.behavior_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert behavior categories" ON public.behavior_categories
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can read behavior categories" ON public.behavior_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update behavior categories" ON public.behavior_categories
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete behavior categories" ON public.behavior_categories
  FOR DELETE TO authenticated USING (true);
