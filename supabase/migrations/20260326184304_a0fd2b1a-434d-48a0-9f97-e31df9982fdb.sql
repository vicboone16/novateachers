
-- Add movement_style to classroom_game_settings
ALTER TABLE public.classroom_game_settings
  ADD COLUMN IF NOT EXISTS movement_style text NOT NULL DEFAULT 'glide';

-- Add track_type to game_tracks  
ALTER TABLE public.game_tracks
  ADD COLUMN IF NOT EXISTS track_type text NOT NULL DEFAULT 'curved';
