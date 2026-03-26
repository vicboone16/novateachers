
-- Default game track: first active track (fallback)
CREATE OR REPLACE VIEW public.v_default_game_track
WITH (security_invoker = true) AS
SELECT t.*
FROM public.game_tracks t
WHERE t.is_active = true
ORDER BY t.is_preset DESC, t.created_at ASC
LIMIT 1;

-- Classroom's resolved active track (joins settings → track, falls back to default)
CREATE OR REPLACE VIEW public.v_classroom_active_track
WITH (security_invoker = true) AS
SELECT
  s.group_id,
  s.movement_style,
  COALESCE(t.id, d.id) AS track_id,
  COALESCE(t.name, d.name) AS name,
  COALESCE(t.description, d.description) AS description,
  COALESCE(t.total_steps, d.total_steps) AS total_steps,
  COALESCE(t.track_type, d.track_type) AS track_type,
  COALESCE(t.nodes_json, d.nodes_json) AS nodes_json,
  COALESCE(t.zones_json, d.zones_json) AS zones_json,
  COALESCE(t.checkpoints_json, d.checkpoints_json) AS checkpoints_json,
  COALESCE(t.theme_slug, d.theme_slug) AS theme_slug,
  COALESCE(t.theme_id, d.theme_id) AS theme_id,
  COALESCE(t.is_active, d.is_active) AS is_active
FROM public.classroom_game_settings s
LEFT JOIN public.game_tracks t ON t.id = s.track_id AND t.is_active = true
LEFT JOIN LATERAL (
  SELECT * FROM public.game_tracks dt
  WHERE dt.is_active = true
  ORDER BY dt.is_preset DESC, dt.created_at ASC
  LIMIT 1
) d ON t.id IS NULL;
