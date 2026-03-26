-- Add SMS channel fields to thread_messages
ALTER TABLE public.thread_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS pingram_tracking_id text,
  ADD COLUMN IF NOT EXISTS pingram_user_id text,
  ADD COLUMN IF NOT EXISTS pingram_notification_type text,
  ADD COLUMN IF NOT EXISTS sms_from_number text,
  ADD COLUMN IF NOT EXISTS sms_to_number text,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS external_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add severity to threads
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS parent_sms_opted_in boolean NOT NULL DEFAULT false;

-- Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_thread_messages_pingram_tracking 
  ON public.thread_messages(pingram_tracking_id) WHERE pingram_tracking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thread_messages_channel 
  ON public.thread_messages(channel) WHERE channel = 'sms';