
-- Add visibility/lifecycle columns to beacon_rewards
ALTER TABLE public.beacon_rewards
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Index for efficient student-facing queries
CREATE INDEX IF NOT EXISTS idx_beacon_rewards_visibility
  ON public.beacon_rewards (scope_type, scope_id, active, hidden, archived, deleted_at);
