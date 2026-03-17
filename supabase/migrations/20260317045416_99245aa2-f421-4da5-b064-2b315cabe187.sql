
-- Notification preferences with platform defaults and user overrides
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agency_id UUID,
  -- Notification type keys (role-neutral)
  notification_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Schedule overrides
  schedule_time TIME,
  schedule_days TEXT[] DEFAULT '{mon,tue,wed,thu,fri}'::TEXT[],
  -- Quiet hours
  quiet_start TIME,
  quiet_end TIME,
  -- Push config
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_key)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences"
  ON public.notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Platform-level default schedules (no user_id, used as template)
CREATE TABLE public.notification_defaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  default_schedule_time TIME,
  default_schedule_days TEXT[] DEFAULT '{mon,tue,wed,thu,fri}'::TEXT[],
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read notification defaults"
  ON public.notification_defaults FOR SELECT
  TO authenticated
  USING (true);

-- Seed platform defaults with role-neutral naming
INSERT INTO public.notification_defaults (notification_key, label, description, default_enabled, default_schedule_time, category, sort_order) VALUES
  ('data_log_reminder', 'Data Log Reminder', 'Reminder to log behavior data during active sessions', true, '09:00', 'reminders', 1),
  ('escalation_alert', 'Escalation Alert', 'Immediate alert when behavior escalation thresholds are reached', true, NULL, 'alerts', 2),
  ('session_note_reminder', 'Session Note Reminder', 'Reminder to complete session notes after data collection', true, '15:00', 'reminders', 3),
  ('caregiver_message', 'Caregiver Message Alert', 'Alert when a caregiver sends a message', true, NULL, 'alerts', 4),
  ('supervision_reminder', 'Supervision Reminder', 'Reminder for upcoming supervision sessions', true, '08:00', 'reminders', 5),
  ('admin_alert', 'Admin Alert', 'System-level alerts for administrators', true, NULL, 'alerts', 6);

-- Push token storage
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push tokens"
  ON public.push_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
