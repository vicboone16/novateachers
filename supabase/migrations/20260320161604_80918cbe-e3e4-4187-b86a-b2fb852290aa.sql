-- Add board_slug column for custom public board URLs
ALTER TABLE public.classroom_groups
ADD COLUMN board_slug text UNIQUE;

-- Index for fast slug lookup
CREATE INDEX idx_classroom_groups_board_slug ON public.classroom_groups(board_slug) WHERE board_slug IS NOT NULL;

-- Allow unauthenticated access to classroom_groups by slug (for public board)
CREATE POLICY "Anyone can read classroom by board_slug"
  ON public.classroom_groups FOR SELECT
  TO anon
  USING (board_slug IS NOT NULL);