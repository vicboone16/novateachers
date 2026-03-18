-- ============================================================
-- Nova Core SQL — Phase 2: Messaging, Board, Contingencies
-- Run on the Core Supabase instance (yboqqmkghwhlhhnsegje)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- A. MESSAGING THREADS
-- ──────────────────────────────────────────────────────────────

-- Threads (conversation containers)
CREATE TABLE IF NOT EXISTS public.threads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL,
  classroom_id  uuid,
  thread_type   text NOT NULL DEFAULT 'team',    -- team, teacher_only, aide, student, one_to_one, announcement
  title         text,
  is_private    boolean NOT NULL DEFAULT false,
  student_id    uuid,                            -- for student-specific threads
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read threads they belong to"
  ON public.threads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.thread_members tm
    WHERE tm.thread_id = threads.id AND tm.user_id = auth.uid()
  ) OR created_by = auth.uid());
CREATE POLICY "Authenticated can create threads"
  ON public.threads FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator can update threads"
  ON public.threads FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Thread members
CREATE TABLE IF NOT EXISTS public.thread_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  role          text NOT NULL DEFAULT 'member',  -- member, admin
  joined_at     timestamptz NOT NULL DEFAULT now(),
  left_at       timestamptz,
  UNIQUE (thread_id, user_id)
);
ALTER TABLE public.thread_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read thread membership"
  ON public.thread_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.thread_members tm2
    WHERE tm2.thread_id = thread_members.thread_id AND tm2.user_id = auth.uid()
  ));
CREATE POLICY "Thread creator or self can insert members"
  ON public.thread_members FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Self can leave (update left_at)"
  ON public.thread_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Messages (within threads)
CREATE TABLE IF NOT EXISTS public.messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  sender_id     uuid NOT NULL,
  parent_id     uuid REFERENCES public.messages(id),
  body          text NOT NULL,
  message_type  text NOT NULL DEFAULT 'text',    -- text, system, attachment
  metadata      jsonb NOT NULL DEFAULT '{}',
  is_deleted    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread members can read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.thread_members tm
    WHERE tm.thread_id = messages.thread_id AND tm.user_id = auth.uid()
  ));
CREATE POLICY "Thread members can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.thread_members tm
    WHERE tm.thread_id = messages.thread_id AND tm.user_id = auth.uid()
  ));
CREATE POLICY "Sender can update own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

-- Message reactions (emoji)
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  emoji         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread members can read reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.thread_members tm ON tm.thread_id = m.thread_id
    WHERE m.id = message_reactions.message_id AND tm.user_id = auth.uid()
  ));
CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Thread mentions (@user tagging)
CREATE TABLE IF NOT EXISTS public.thread_mentions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  is_read       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.thread_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mentioned user can read"
  ON public.thread_mentions FOR SELECT TO authenticated
  USING (mentioned_user_id = auth.uid());
CREATE POLICY "Message sender can insert mentions"
  ON public.thread_mentions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = thread_mentions.message_id AND m.sender_id = auth.uid()
  ));
CREATE POLICY "Mentioned user can mark read"
  ON public.thread_mentions FOR UPDATE TO authenticated
  USING (mentioned_user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- B. CLASSROOM FEED EXTENSIONS
-- ──────────────────────────────────────────────────────────────

-- Post-student tags (tag specific students in feed posts)
CREATE TABLE IF NOT EXISTS public.post_student_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL,
  student_id    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, student_id)
);
ALTER TABLE public.post_student_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read post tags"
  ON public.post_student_tags FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Post author can insert tags"
  ON public.post_student_tags FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Post author can delete tags"
  ON public.post_student_tags FOR DELETE TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- C. CLASSROOM BOARD SETTINGS
-- ──────────────────────────────────────────────────────────────

-- Board display settings per classroom
CREATE TABLE IF NOT EXISTS public.classroom_board_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id    uuid NOT NULL UNIQUE,
  agency_id       uuid NOT NULL,
  theme_id        uuid,
  show_points     boolean NOT NULL DEFAULT true,
  show_class_goal boolean NOT NULL DEFAULT true,
  show_mission    boolean NOT NULL DEFAULT true,
  show_word_of_week boolean NOT NULL DEFAULT true,
  show_reward_progress boolean NOT NULL DEFAULT true,
  show_celebrations boolean NOT NULL DEFAULT true,
  mission_text    text,
  word_of_week    text,
  class_goal_label text DEFAULT 'Class Goal',
  class_goal_target integer DEFAULT 100,
  class_goal_current integer DEFAULT 0,
  updated_by      uuid NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classroom_board_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read board settings"
  ON public.classroom_board_settings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can upsert board settings"
  ON public.classroom_board_settings FOR INSERT TO authenticated
  WITH CHECK (updated_by = auth.uid());
CREATE POLICY "Staff can update board settings"
  ON public.classroom_board_settings FOR UPDATE TO authenticated
  USING (updated_by = auth.uid());

-- Board themes (visual presets)
CREATE TABLE IF NOT EXISTS public.board_themes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  bg_color        text NOT NULL DEFAULT '#1a1a2e',
  text_color      text NOT NULL DEFAULT '#ffffff',
  accent_color    text NOT NULL DEFAULT '#e94560',
  font_family     text NOT NULL DEFAULT 'Space Grotesk',
  is_preset       boolean NOT NULL DEFAULT true,
  agency_id       uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.board_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read themes"
  ON public.board_themes FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can insert custom themes"
  ON public.board_themes FOR INSERT TO authenticated
  WITH CHECK (is_preset = false);

-- Student display profiles for board (first name overrides, avatar)
CREATE TABLE IF NOT EXISTS public.student_board_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL,
  classroom_id    uuid NOT NULL,
  display_name    text NOT NULL,       -- first name only for privacy
  avatar_emoji    text DEFAULT '⭐',
  is_visible      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, classroom_id)
);
ALTER TABLE public.student_board_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read board profiles"
  ON public.student_board_profiles FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can manage board profiles"
  ON public.student_board_profiles FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Staff can update board profiles"
  ON public.student_board_profiles FOR UPDATE TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- D. CONTINGENCIES AND CULTURE PROMPTS
-- ──────────────────────────────────────────────────────────────

-- Class contingencies (rewards tied to class-level goals)
CREATE TABLE IF NOT EXISTS public.class_contingencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id    uuid NOT NULL,
  agency_id       uuid NOT NULL,
  name            text NOT NULL,
  description     text,
  target_metric   text NOT NULL DEFAULT 'total_points',  -- total_points, avg_engagement, behavior_free_minutes
  target_value    integer NOT NULL DEFAULT 100,
  current_value   integer NOT NULL DEFAULT 0,
  reward_name     text NOT NULL DEFAULT 'Class Party',
  is_active       boolean NOT NULL DEFAULT true,
  earned_at       timestamptz,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.class_contingencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read contingencies"
  ON public.class_contingencies FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can create contingencies"
  ON public.class_contingencies FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update own contingencies"
  ON public.class_contingencies FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Schoolwide contingencies
CREATE TABLE IF NOT EXISTS public.schoolwide_contingencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL,
  school_name     text,
  name            text NOT NULL,
  description     text,
  target_metric   text NOT NULL DEFAULT 'total_points',
  target_value    integer NOT NULL DEFAULT 500,
  current_value   integer NOT NULL DEFAULT 0,
  reward_name     text NOT NULL DEFAULT 'School Celebration',
  is_active       boolean NOT NULL DEFAULT true,
  earned_at       timestamptz,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schoolwide_contingencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read schoolwide contingencies"
  ON public.schoolwide_contingencies FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can create schoolwide contingencies"
  ON public.schoolwide_contingencies FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update own schoolwide contingencies"
  ON public.schoolwide_contingencies FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- School culture prompts (mission of the day, word of the week, etc.)
CREATE TABLE IF NOT EXISTS public.school_culture_prompts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL,
  classroom_id    uuid,                -- null = schoolwide
  prompt_type     text NOT NULL DEFAULT 'mission',  -- mission, word_of_week, affirmation, challenge
  content         text NOT NULL,
  active_date     date,
  active_week_start date,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_culture_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read culture prompts"
  ON public.school_culture_prompts FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can create culture prompts"
  ON public.school_culture_prompts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff can update own culture prompts"
  ON public.school_culture_prompts FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- REALTIME
-- ──────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_contingencies;

-- Schema cache reload
SELECT pg_notify('pgrst', 'reload schema');
