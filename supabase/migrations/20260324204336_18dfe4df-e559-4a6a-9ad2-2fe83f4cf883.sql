CREATE TABLE public.token_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  classroom_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  token_target integer NOT NULL DEFAULT 10,
  current_tokens integer NOT NULL DEFAULT 0,
  reward_name text NOT NULL DEFAULT 'Free Choice',
  reward_emoji text NOT NULL DEFAULT '🎁',
  skin text NOT NULL DEFAULT 'stars',
  auto_reset boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, classroom_id)
);

ALTER TABLE public.token_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open all token_boards"
  ON public.token_boards FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);