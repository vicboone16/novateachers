
-- Teacher Inbox / Messaging System
-- Supports: BIPs, notes, action items, document attachments, two-way threads

CREATE TABLE public.teacher_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  thread_id uuid,
  parent_id uuid REFERENCES public.teacher_messages(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'note' CHECK (message_type IN ('note', 'bip', 'action_item', 'document')),
  subject text,
  body text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'read', 'reviewed', 'action_required', 'completed')),
  client_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Thread ID defaults to message ID for root messages
CREATE OR REPLACE FUNCTION public.set_thread_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.thread_id IS NULL THEN
    NEW.thread_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_thread_id
  BEFORE INSERT ON public.teacher_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_thread_id();

-- Attachments for messages
CREATE TABLE public.teacher_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.teacher_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_teacher_messages_recipient ON public.teacher_messages(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_teacher_messages_thread ON public.teacher_messages(thread_id, created_at);
CREATE INDEX idx_teacher_messages_agency ON public.teacher_messages(agency_id);
CREATE INDEX idx_teacher_message_attachments_msg ON public.teacher_message_attachments(message_id);

-- RLS
ALTER TABLE public.teacher_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_message_attachments ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received
CREATE POLICY "Users can read own messages"
  ON public.teacher_messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Users can insert messages they send
CREATE POLICY "Users can send messages"
  ON public.teacher_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Recipients can update (mark read/reviewed)
CREATE POLICY "Recipients can update messages"
  ON public.teacher_messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());

-- Attachment policies follow parent message access
CREATE POLICY "Users can read attachments of their messages"
  ON public.teacher_message_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teacher_messages m
    WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
  ));

CREATE POLICY "Users can add attachments to their messages"
  ON public.teacher_message_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.teacher_messages m
    WHERE m.id = message_id AND m.sender_id = auth.uid()
  ));

-- Pending Changes table for sync approval workflow
CREATE TABLE public.pending_student_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  change_type text NOT NULL DEFAULT 'update' CHECK (change_type IN ('update', 'create', 'delete')),
  field_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_student_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pending changes"
  ON public.pending_student_changes FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR reviewed_by = auth.uid());

CREATE POLICY "Users can create pending changes"
  ON public.pending_student_changes FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Reviewers can update pending changes"
  ON public.pending_student_changes FOR UPDATE TO authenticated
  USING (true);

CREATE INDEX idx_pending_changes_agency ON public.pending_student_changes(agency_id, status);
CREATE INDEX idx_pending_changes_client ON public.pending_student_changes(client_id);

-- Enable realtime for inbox
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_messages;
