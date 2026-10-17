-- Parent-link credentials are resolved and managed only by verified server endpoints.
REVOKE ALL ON TABLE public.parent_access_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.parent_access_links TO service_role;
ALTER TABLE public.parent_access_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can read parent access links" ON public.parent_access_links;
DROP POLICY IF EXISTS "Anon can update parent access links" ON public.parent_access_links;
DROP POLICY IF EXISTS "Authenticated can manage parent access links" ON public.parent_access_links;