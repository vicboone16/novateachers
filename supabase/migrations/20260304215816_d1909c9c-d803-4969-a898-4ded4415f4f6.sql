
-- Teacher Quick Add: Frequency entries
CREATE TABLE public.teacher_frequency_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  target_id uuid,
  behavior_name text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_frequency_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own frequency entries"
  ON public.teacher_frequency_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own frequency entries"
  ON public.teacher_frequency_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own frequency entries"
  ON public.teacher_frequency_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own frequency entries"
  ON public.teacher_frequency_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Teacher Quick Add: Duration entries
CREATE TABLE public.teacher_duration_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  target_id uuid,
  behavior_name text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_duration_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own duration entries"
  ON public.teacher_duration_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own duration entries"
  ON public.teacher_duration_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own duration entries"
  ON public.teacher_duration_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own duration entries"
  ON public.teacher_duration_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Teacher Quick Add: Quick notes
CREATE TABLE public.teacher_quick_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  target_id uuid,
  behavior_name text,
  note text NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_quick_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own quick notes"
  ON public.teacher_quick_notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own quick notes"
  ON public.teacher_quick_notes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own quick notes"
  ON public.teacher_quick_notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
