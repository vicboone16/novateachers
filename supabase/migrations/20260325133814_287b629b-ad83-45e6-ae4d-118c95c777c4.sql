
-- ============================================
-- Message Reactions & Read Receipts
-- ============================================

-- 1. thread_reactions — emoji reactions on messages
CREATE TABLE public.thread_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL DEFAULT '👍',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.thread_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reactions"
  ON public.thread_reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reactions"
  ON public.thread_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON public.thread_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2. thread_read_receipts — per-user read cursor
CREATE TABLE public.thread_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_message_id UUID REFERENCES public.thread_messages(id),
  UNIQUE(thread_id, user_id)
);

ALTER TABLE public.thread_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read receipts"
  ON public.thread_read_receipts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can upsert own read receipts"
  ON public.thread_read_receipts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own read receipts"
  ON public.thread_read_receipts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_read_receipts;

-- Index for fast lookups
CREATE INDEX idx_thread_reactions_message ON public.thread_reactions(message_id);
CREATE INDEX idx_thread_read_receipts_thread ON public.thread_read_receipts(thread_id);
CREATE INDEX idx_thread_read_receipts_user ON public.thread_read_receipts(user_id);
