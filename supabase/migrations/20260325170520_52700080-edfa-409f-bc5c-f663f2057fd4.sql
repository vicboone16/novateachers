
-- Add staff_reply columns to parent_actions for deeper parent-teacher messaging
ALTER TABLE public.parent_actions
ADD COLUMN IF NOT EXISTS staff_reply text,
ADD COLUMN IF NOT EXISTS staff_reply_at timestamptz;

-- Add columns to parent_actions if staff_viewed_at doesn't exist
ALTER TABLE public.parent_actions
ADD COLUMN IF NOT EXISTS staff_viewed_at timestamptz;
