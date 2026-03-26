
INSERT INTO public.game_tracks (name, track_type, total_steps, is_preset, is_active, nodes_json, zones_json, checkpoints_json, description)
VALUES
  ('Zig Zag Canyon', 'zigzag', 100, true, true,
   '[{"x":5,"y":50},{"x":20,"y":15},{"x":35,"y":85},{"x":50,"y":15},{"x":65,"y":85},{"x":80,"y":15},{"x":95,"y":50}]'::jsonb,
   '[{"start_pct":0.3,"end_pct":0.45,"type":"boost","multiplier":1.5,"color":"#22d3ee","label":"Turbo Zone"},{"start_pct":0.7,"end_pct":0.85,"type":"bonus","multiplier":2,"color":"#fbbf24","label":"Bonus Valley"}]'::jsonb,
   '[{"progress_pct":0.25,"reward_points":5,"label":"Quarter Mark"},{"progress_pct":0.5,"reward_points":10,"label":"Halfway"},{"progress_pct":0.75,"reward_points":5,"label":"Three Quarters"}]'::jsonb,
   'Sharp zigzag path through a canyon'),

  ('Island Adventure', 'map', 120, true, true,
   '[{"x":10,"y":90},{"x":25,"y":70},{"x":15,"y":45},{"x":35,"y":30},{"x":55,"y":45},{"x":70,"y":25},{"x":85,"y":40},{"x":90,"y":15}]'::jsonb,
   '[{"start_pct":0.2,"end_pct":0.35,"type":"reward","multiplier":1,"color":"#4ade80","label":"Treasure Beach"},{"start_pct":0.6,"end_pct":0.75,"type":"boost","multiplier":1.5,"color":"#818cf8","label":"Wind Current"}]'::jsonb,
   '[{"progress_pct":0.33,"reward_points":8,"label":"First Island"},{"progress_pct":0.66,"reward_points":8,"label":"Second Island"},{"progress_pct":1.0,"reward_points":15,"label":"Final Island"}]'::jsonb,
   'Explore islands across the map'),

  ('Board Game Classic', 'board_nodes', 80, true, true,
   '[{"x":10,"y":90},{"x":30,"y":90},{"x":50,"y":90},{"x":70,"y":90},{"x":90,"y":90},{"x":90,"y":60},{"x":70,"y":60},{"x":50,"y":60},{"x":30,"y":60},{"x":10,"y":60},{"x":10,"y":30},{"x":30,"y":30},{"x":50,"y":30},{"x":70,"y":30},{"x":90,"y":30},{"x":90,"y":10},{"x":50,"y":10}]'::jsonb,
   '[{"start_pct":0.2,"end_pct":0.3,"type":"boost","multiplier":2,"color":"#f472b6","label":"Double Roll"},{"start_pct":0.55,"end_pct":0.65,"type":"slow","multiplier":0.5,"color":"#fb923c","label":"Mud Pit"},{"start_pct":0.85,"end_pct":0.95,"type":"bonus","multiplier":1.5,"color":"#a78bfa","label":"Star Space"}]'::jsonb,
   '[{"progress_pct":0.25,"reward_points":5,"label":"Corner 1"},{"progress_pct":0.5,"reward_points":10,"label":"Halfway"},{"progress_pct":0.75,"reward_points":5,"label":"Corner 3"}]'::jsonb,
   'Classic board game layout with snaking path'),

  ('Speed Lanes', 'lanes', 100, true, true,
   '[{"x":5,"y":50},{"x":15,"y":50},{"x":25,"y":50},{"x":35,"y":50},{"x":45,"y":50},{"x":55,"y":50},{"x":65,"y":50},{"x":75,"y":50},{"x":85,"y":50},{"x":95,"y":50}]'::jsonb,
   '[{"start_pct":0.3,"end_pct":0.5,"type":"boost","multiplier":2,"color":"#ef4444","label":"Nitro Zone"},{"start_pct":0.7,"end_pct":0.85,"type":"boost","multiplier":1.5,"color":"#3b82f6","label":"Draft Zone"}]'::jsonb,
   '[{"progress_pct":0.2,"reward_points":3,"label":"Lap 1"},{"progress_pct":0.4,"reward_points":3,"label":"Lap 2"},{"progress_pct":0.6,"reward_points":5,"label":"Lap 3"},{"progress_pct":0.8,"reward_points":5,"label":"Lap 4"}]'::jsonb,
   'Straight racing lanes with speed zones'),

  ('Deep Space', 'depth_track', 100, true, true,
   '[{"x":50,"y":95},{"x":35,"y":80},{"x":60,"y":65},{"x":40,"y":50},{"x":55,"y":35},{"x":50,"y":20},{"x":50,"y":5}]'::jsonb,
   '[{"start_pct":0.15,"end_pct":0.3,"type":"boost","multiplier":1.5,"color":"#6366f1","label":"Warp Field"},{"start_pct":0.5,"end_pct":0.65,"type":"bonus","multiplier":2,"color":"#f59e0b","label":"Star Cluster"},{"start_pct":0.8,"end_pct":0.95,"type":"reward","multiplier":1,"color":"#10b981","label":"Space Station"}]'::jsonb,
   '[{"progress_pct":0.25,"reward_points":5,"label":"Orbit 1"},{"progress_pct":0.5,"reward_points":10,"label":"Deep Space"},{"progress_pct":0.75,"reward_points":5,"label":"Near Star"},{"progress_pct":1.0,"reward_points":15,"label":"Destination"}]'::jsonb,
   'Journey into deep space with perspective depth'),

  ('Jungle Trek', 'curved', 110, true, true,
   '[{"x":5,"y":85},{"x":15,"y":60},{"x":30,"y":75},{"x":45,"y":40},{"x":60,"y":65},{"x":75,"y":30},{"x":90,"y":15}]'::jsonb,
   '[{"start_pct":0.1,"end_pct":0.25,"type":"slow","multiplier":0.7,"color":"#15803d","label":"Dense Brush"},{"start_pct":0.45,"end_pct":0.6,"type":"boost","multiplier":1.5,"color":"#eab308","label":"River Rapids"},{"start_pct":0.8,"end_pct":0.95,"type":"bonus","multiplier":2,"color":"#dc2626","label":"Temple Run"}]'::jsonb,
   '[{"progress_pct":0.33,"reward_points":5,"label":"River Crossing"},{"progress_pct":0.66,"reward_points":10,"label":"Canopy Bridge"},{"progress_pct":1.0,"reward_points":15,"label":"Lost Temple"}]'::jsonb,
   'Wind through the jungle to the lost temple')
ON CONFLICT DO NOTHING;
