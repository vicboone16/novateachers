-- Fix RLS on game tables to allow anon role (Cloud client has no auth session)

-- classroom_game_settings
DROP POLICY IF EXISTS "auth_all_classroom_game_settings" ON public.classroom_game_settings;
CREATE POLICY "open_all_classroom_game_settings" ON public.classroom_game_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- classroom_teams
DROP POLICY IF EXISTS "Authenticated users can manage classroom teams" ON public.classroom_teams;
DROP POLICY IF EXISTS "Authenticated users can read classroom teams" ON public.classroom_teams;
CREATE POLICY "open_all_classroom_teams" ON public.classroom_teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- game_modes
DROP POLICY IF EXISTS "anyone_read_game_modes" ON public.game_modes;
CREATE POLICY "open_read_game_modes" ON public.game_modes FOR SELECT TO anon, authenticated USING (true);

-- game_themes
DROP POLICY IF EXISTS "anyone_read_game_themes" ON public.game_themes;
CREATE POLICY "open_read_game_themes" ON public.game_themes FOR SELECT TO anon, authenticated USING (true);

-- classroom_public_links (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='classroom_public_links') THEN
    EXECUTE 'ALTER TABLE public.classroom_public_links ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "open_all_classroom_public_links" ON public.classroom_public_links FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;