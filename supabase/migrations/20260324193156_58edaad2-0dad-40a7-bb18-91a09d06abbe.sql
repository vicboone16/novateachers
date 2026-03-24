-- Create threads table for Slack-style messaging
CREATE TABLE IF NOT EXISTS public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  thread_type text NOT NULL DEFAULT 'team',
  title text,
  classroom_id uuid REFERENCES public.classroom_groups(group_id) ON DELETE SET NULL,
  is_private boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text
);

-- Create thread_members table
CREATE TABLE IF NOT EXISTS public.thread_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  is_muted boolean NOT NULL DEFAULT false,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

-- Create messages table for thread messages
CREATE TABLE IF NOT EXISTS public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  parent_id uuid REFERENCES public.thread_messages(id) ON DELETE SET NULL,
  body text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS public.thread_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Open read threads" ON public.threads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert threads" ON public.threads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update threads" ON public.threads FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete threads" ON public.threads FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Open read thread_members" ON public.thread_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert thread_members" ON public.thread_members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update thread_members" ON public.thread_members FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete thread_members" ON public.thread_members FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Open read thread_messages" ON public.thread_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert thread_messages" ON public.thread_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update thread_messages" ON public.thread_messages FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Open read thread_message_reactions" ON public.thread_message_reactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert thread_message_reactions" ON public.thread_message_reactions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open delete thread_message_reactions" ON public.thread_message_reactions FOR DELETE TO anon, authenticated USING (true);

-- Enable realtime for thread_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_messages;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threads_agency ON public.threads(agency_id);
CREATE INDEX IF NOT EXISTS idx_threads_classroom ON public.threads(classroom_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_thread ON public.thread_members(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_user ON public.thread_members(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread ON public.thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_sender ON public.thread_messages(sender_id);

-- Function to auto-update thread's last_message_at
CREATE OR REPLACE FUNCTION public.update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.threads 
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.body, 100),
      updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_thread_last_message
  AFTER INSERT ON public.thread_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_last_message();