-- Create classroom_public_links table for public classroom board links
CREATE TABLE IF NOT EXISTS public.classroom_public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  agency_id text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_public_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all_classroom_public_links" ON public.classroom_public_links FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);