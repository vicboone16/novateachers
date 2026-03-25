
-- Game tracks: reusable track templates with node-based paths
CREATE TABLE public.game_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  nodes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_steps integer NOT NULL DEFAULT 100,
  theme_slug text DEFAULT 'default',
  is_preset boolean NOT NULL DEFAULT false,
  agency_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_read_game_tracks" ON public.game_tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_can_insert_game_tracks" ON public.game_tracks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_can_update_game_tracks" ON public.game_tracks FOR UPDATE TO authenticated USING (true);

-- Seed default curved track
INSERT INTO public.game_tracks (name, description, is_preset, theme_slug, total_steps, nodes_json)
VALUES (
  'Default Curved Track',
  'A gentle curved race track with 6 waypoints',
  true,
  'default',
  100,
  '[
    {"x": 5, "y": 85, "label": "Start"},
    {"x": 25, "y": 60},
    {"x": 45, "y": 40},
    {"x": 60, "y": 55},
    {"x": 80, "y": 30},
    {"x": 95, "y": 15, "label": "Finish"}
  ]'::jsonb
);

-- Classroom game settings: per-classroom game configuration
CREATE TABLE public.classroom_game_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  track_id uuid REFERENCES public.game_tracks(id),
  game_mode text NOT NULL DEFAULT 'race',
  allow_team_mode boolean NOT NULL DEFAULT false,
  total_steps integer NOT NULL DEFAULT 100,
  show_leaderboard boolean NOT NULL DEFAULT true,
  show_avatars boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id)
);

ALTER TABLE public.classroom_game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_classroom_game_settings" ON public.classroom_game_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
