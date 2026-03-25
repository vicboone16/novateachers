
-- 1. Add missing columns to game_tracks
ALTER TABLE public.game_tracks
  ADD COLUMN IF NOT EXISTS zones_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS checkpoints_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS theme_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Add missing columns to game_events
ALTER TABLE public.game_events
  ADD COLUMN IF NOT EXISTS zone_type text,
  ADD COLUMN IF NOT EXISTS multiplier_applied numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_checkpoint boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_game_events_classroom ON public.game_events(classroom_id);
CREATE INDEX IF NOT EXISTS idx_game_events_student ON public.game_events(student_id);
CREATE INDEX IF NOT EXISTS idx_game_events_type ON public.game_events(event_type);

-- 3. Create game_themes table
CREATE TABLE IF NOT EXISTS public.game_themes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  colors_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  assets_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  avatar_style text DEFAULT 'emoji',
  is_preset boolean NOT NULL DEFAULT true,
  agency_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_game_themes" ON public.game_themes FOR SELECT TO authenticated USING (true);

-- 4. Create game_modes table
CREATE TABLE IF NOT EXISTS public.game_modes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  momentum_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  comeback_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  checkpoint_rewards_enabled boolean NOT NULL DEFAULT true,
  max_daily_points integer DEFAULT 500,
  game_speed numeric DEFAULT 1.0,
  difficulty_scaling text DEFAULT 'adaptive',
  is_preset boolean NOT NULL DEFAULT true,
  agency_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_modes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_game_modes" ON public.game_modes FOR SELECT TO authenticated USING (true);

-- 5. Add theme_id and mode_id to classroom_game_settings
ALTER TABLE public.classroom_game_settings
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.game_themes(id),
  ADD COLUMN IF NOT EXISTS mode_id uuid REFERENCES public.game_modes(id);

-- 6. Seed game themes
INSERT INTO public.game_themes (name, slug, colors_json, assets_json, avatar_style) VALUES
  ('Space Race', 'space', '{"primary":"hsl(240,70%,50%)","accent":"hsl(280,80%,60%)","bg":"hsl(240,20%,8%)","track":"hsl(220,60%,40%)","glow":"hsl(260,90%,70%)"}', '{"background":"stars","particles":"sparkles","trackStyle":"neon"}', 'emoji'),
  ('Ocean Adventure', 'ocean', '{"primary":"hsl(200,80%,45%)","accent":"hsl(170,70%,50%)","bg":"hsl(200,40%,12%)","track":"hsl(190,60%,35%)","glow":"hsl(180,80%,60%)"}', '{"background":"waves","particles":"bubbles","trackStyle":"flow"}', 'emoji'),
  ('Jungle Trek', 'jungle', '{"primary":"hsl(120,50%,35%)","accent":"hsl(45,80%,50%)","bg":"hsl(120,30%,10%)","track":"hsl(100,40%,30%)","glow":"hsl(80,70%,50%)"}', '{"background":"vines","particles":"leaves","trackStyle":"natural"}', 'emoji'),
  ('Superhero Arena', 'superhero', '{"primary":"hsl(0,80%,50%)","accent":"hsl(45,100%,50%)","bg":"hsl(230,25%,10%)","track":"hsl(0,60%,40%)","glow":"hsl(45,90%,60%)"}', '{"background":"city","particles":"lightning","trackStyle":"bold"}', 'emoji')
ON CONFLICT (slug) DO NOTHING;

-- 7. Seed game modes
INSERT INTO public.game_modes (name, slug, description, momentum_config_json, comeback_config_json, checkpoint_rewards_enabled, max_daily_points, game_speed) VALUES
  ('Race', 'race', 'Classic race to the finish line', '{"streak_thresholds":[{"count":3,"multiplier":1.5,"label":"On Fire!","emoji":"🔥"},{"count":5,"multiplier":2.0,"label":"Unstoppable!","emoji":"🚀"},{"count":10,"multiplier":3.0,"label":"Legendary!","emoji":"💥"}]}', '{"behind_rank_threshold":3,"bonus_multiplier":1.25,"label":"Comeback Boost","emoji":"💪"}', true, 500, 1.0),
  ('Level', 'level', 'Level up with XP progression', '{"streak_thresholds":[{"count":3,"multiplier":1.5,"label":"On Fire!","emoji":"🔥"},{"count":5,"multiplier":2.0,"label":"Unstoppable!","emoji":"🚀"},{"count":10,"multiplier":3.0,"label":"Legendary!","emoji":"💥"}]}', '{"behind_rank_threshold":5,"bonus_multiplier":1.5,"label":"Comeback Boost","emoji":"💪"}', true, 500, 1.0),
  ('Team', 'team', 'Team-based competition', '{"streak_thresholds":[{"count":3,"multiplier":1.5,"label":"On Fire!","emoji":"🔥"},{"count":5,"multiplier":2.0,"label":"Unstoppable!","emoji":"🚀"},{"count":10,"multiplier":3.0,"label":"Legendary!","emoji":"💥"}]}', '{"behind_rank_threshold":2,"bonus_multiplier":1.3,"label":"Underdog Boost","emoji":"🐶"}', true, 500, 1.0)
ON CONFLICT (slug) DO NOTHING;

-- 8. Update existing tracks with zones + checkpoints
UPDATE public.game_tracks SET
  zones_json = '[{"start_pct":0.2,"end_pct":0.35,"type":"boost","multiplier":1.5,"color":"hsl(142,71%,45%)","label":"Speed Boost"},{"start_pct":0.5,"end_pct":0.6,"type":"reward","multiplier":1.0,"color":"hsl(48,96%,53%)","label":"Treasure Zone"},{"start_pct":0.75,"end_pct":0.85,"type":"bonus","multiplier":2.0,"color":"hsl(280,80%,60%)","label":"Bonus Zone"}]',
  checkpoints_json = '[{"progress_pct":0.25,"reward_points":5,"label":"Quarter Mark"},{"progress_pct":0.5,"reward_points":10,"label":"Halfway!"},{"progress_pct":0.75,"reward_points":5,"label":"Almost There!"},{"progress_pct":1.0,"reward_points":20,"label":"Finish!"}]'
WHERE name = 'Default Curved Track';

-- 9. Seed additional themed tracks
INSERT INTO public.game_tracks (name, description, nodes_json, total_steps, is_preset, zones_json, checkpoints_json) VALUES
  ('Mountain Climb', 'A steep ascent with switchbacks', '[{"x":5,"y":90},{"x":20,"y":70},{"x":10,"y":50},{"x":30,"y":35},{"x":20,"y":20},{"x":50,"y":10},{"x":70,"y":20},{"x":90,"y":5}]', 120, true,
   '[{"start_pct":0.1,"end_pct":0.2,"type":"slow","multiplier":0.75,"color":"hsl(200,60%,70%)","label":"Ice Patch"},{"start_pct":0.4,"end_pct":0.55,"type":"boost","multiplier":1.5,"color":"hsl(142,71%,45%)","label":"Tailwind"},{"start_pct":0.7,"end_pct":0.8,"type":"reward","multiplier":1.0,"color":"hsl(48,96%,53%)","label":"Summit Cache"}]',
   '[{"progress_pct":0.25,"reward_points":5,"label":"Base Camp"},{"progress_pct":0.5,"reward_points":10,"label":"Ridge Line"},{"progress_pct":0.75,"reward_points":5,"label":"Final Push"},{"progress_pct":1.0,"reward_points":25,"label":"Summit!"}]'),
  ('Ocean Dive', 'Dive deep and resurface', '[{"x":5,"y":20},{"x":20,"y":40},{"x":35,"y":70},{"x":50,"y":85},{"x":65,"y":70},{"x":80,"y":40},{"x":95,"y":15}]', 100, true,
   '[{"start_pct":0.15,"end_pct":0.3,"type":"slow","multiplier":0.8,"color":"hsl(200,60%,70%)","label":"Deep Current"},{"start_pct":0.45,"end_pct":0.55,"type":"reward","multiplier":1.0,"color":"hsl(48,96%,53%)","label":"Treasure Chest"},{"start_pct":0.7,"end_pct":0.85,"type":"boost","multiplier":1.5,"color":"hsl(142,71%,45%)","label":"Rising Tide"}]',
   '[{"progress_pct":0.25,"reward_points":5,"label":"Shallow Reef"},{"progress_pct":0.5,"reward_points":10,"label":"Ocean Floor"},{"progress_pct":0.75,"reward_points":5,"label":"Rising Up"},{"progress_pct":1.0,"reward_points":20,"label":"Surface!"}]'),
  ('Galaxy Loop', 'A looping orbital track', '[{"x":50,"y":5},{"x":85,"y":20},{"x":95,"y":50},{"x":85,"y":80},{"x":50,"y":95},{"x":15,"y":80},{"x":5,"y":50},{"x":15,"y":20},{"x":50,"y":5}]', 150, true,
   '[{"start_pct":0.1,"end_pct":0.25,"type":"boost","multiplier":1.5,"color":"hsl(142,71%,45%)","label":"Warp Speed"},{"start_pct":0.35,"end_pct":0.45,"type":"bonus","multiplier":2.0,"color":"hsl(280,80%,60%)","label":"Nebula Boost"},{"start_pct":0.6,"end_pct":0.7,"type":"slow","multiplier":0.7,"color":"hsl(200,60%,70%)","label":"Gravity Well"},{"start_pct":0.8,"end_pct":0.9,"type":"reward","multiplier":1.0,"color":"hsl(48,96%,53%)","label":"Star Cache"}]',
   '[{"progress_pct":0.25,"reward_points":5,"label":"First Orbit"},{"progress_pct":0.5,"reward_points":10,"label":"Half Orbit"},{"progress_pct":0.75,"reward_points":5,"label":"Final Stretch"},{"progress_pct":1.0,"reward_points":30,"label":"Full Orbit!"}]')
ON CONFLICT DO NOTHING;
