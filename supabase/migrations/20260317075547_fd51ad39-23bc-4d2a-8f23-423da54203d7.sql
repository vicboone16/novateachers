
-- Fix effective_user_reminders view: use SECURITY INVOKER
CREATE OR REPLACE VIEW public.effective_user_reminders
  WITH (security_invoker = true)
AS
WITH current_user_prefs AS (
  SELECT np.user_id,
    np.push_enabled,
    np.local_reminders_enabled,
    np.data_log_reminders,
    np.escalation_alerts,
    np.session_note_reminders,
    np.caregiver_messages,
    np.supervision_reminders,
    np.admin_alerts,
    np.quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end
  FROM public.notification_preferences np
), candidate_defaults AS (
  SELECT auth.uid() AS user_id,
    drs.id AS default_schedule_id,
    drs.scope_type,
    drs.scope_rank,
    drs.owner_user_id,
    drs.organization_id,
    drs.school_id,
    drs.classroom_id,
    drs.role_scope,
    drs.name,
    drs.reminder_key,
    drs.reminder_type,
    drs.timezone,
    drs.allow_user_override,
    drs.local_enabled,
    drs.remote_enabled,
    drs.start_time,
    drs.end_time,
    drs.days_of_week,
    drs.interval_minutes,
    drs.grace_period_minutes,
    drs.message_title,
    drs.message_body,
    drs.app_environment,
    row_number() OVER (PARTITION BY drs.reminder_key, drs.app_environment ORDER BY drs.scope_rank, drs.created_at DESC) AS rn
  FROM public.default_reminder_scope_rank drs
  WHERE drs.app_environment = ANY (ARRAY['beta','production','development'])
    AND (drs.scope_type = 'platform' OR (drs.scope_type = 'user' AND drs.owner_user_id = auth.uid()))
), selected_defaults AS (
  SELECT * FROM candidate_defaults WHERE rn = 1
), merged AS (
  SELECT sd.user_id,
    sd.default_schedule_id,
    sd.scope_type AS source_scope_type,
    sd.name AS default_name,
    sd.reminder_key,
    sd.reminder_type,
    sd.app_environment,
    COALESCE(uro.override_enabled, false) AS override_enabled,
    COALESCE(uro.notifications_enabled, true) AS notifications_enabled,
    uro.id AS override_id,
    CASE WHEN COALESCE(uro.override_enabled, false) AND uro.custom_name IS NOT NULL THEN uro.custom_name ELSE sd.name END AS effective_name,
    CASE WHEN COALESCE(uro.override_enabled, false) AND uro.custom_timezone IS NOT NULL THEN uro.custom_timezone ELSE sd.timezone END AS effective_timezone,
    CASE WHEN COALESCE(uro.override_enabled, false) AND uro.custom_start_time IS NOT NULL THEN uro.custom_start_time ELSE sd.start_time END AS effective_start_time,
    CASE WHEN COALESCE(uro.override_enabled, false) AND uro.custom_end_time IS NOT NULL THEN uro.custom_end_time ELSE sd.end_time END AS effective_end_time,
    CASE WHEN COALESCE(uro.override_enabled, false) AND uro.custom_days_of_week IS NOT NULL THEN uro.custom_days_of_week ELSE sd.days_of_week END AS effective_days_of_week,
    CASE WHEN COALESCE(uro.override_enabled, false) AND uro.custom_interval_minutes IS NOT NULL THEN uro.custom_interval_minutes ELSE sd.interval_minutes END AS effective_interval_minutes,
    CASE WHEN COALESCE(uro.override_enabled, false) AND uro.local_enabled IS NOT NULL THEN uro.local_enabled ELSE sd.local_enabled END AS effective_local_enabled,
    CASE WHEN COALESCE(uro.override_enabled, false) AND uro.remote_enabled IS NOT NULL THEN uro.remote_enabled ELSE sd.remote_enabled END AS effective_remote_enabled,
    sd.allow_user_override,
    sd.grace_period_minutes,
    sd.message_title,
    sd.message_body,
    cup.push_enabled,
    cup.local_reminders_enabled,
    cup.data_log_reminders,
    cup.escalation_alerts,
    cup.session_note_reminders,
    cup.caregiver_messages,
    cup.supervision_reminders,
    cup.admin_alerts,
    cup.quiet_hours_enabled,
    cup.quiet_hours_start,
    cup.quiet_hours_end,
    CASE
      WHEN COALESCE(uro.notifications_enabled, true) = false THEN false
      WHEN cup.push_enabled = false AND cup.local_reminders_enabled = false THEN false
      WHEN sd.reminder_key = 'data_log_reminder' AND cup.data_log_reminders = false THEN false
      WHEN sd.reminder_key = 'escalation_alert' AND cup.escalation_alerts = false THEN false
      WHEN sd.reminder_key = 'session_note_reminder' AND cup.session_note_reminders = false THEN false
      WHEN sd.reminder_key = 'caregiver_message' AND cup.caregiver_messages = false THEN false
      WHEN sd.reminder_key = 'supervision_reminder' AND cup.supervision_reminders = false THEN false
      WHEN sd.reminder_key = 'admin_alert' AND cup.admin_alerts = false THEN false
      ELSE true
    END AS effective_enabled
  FROM selected_defaults sd
    LEFT JOIN public.user_reminder_overrides uro
      ON uro.default_schedule_id = sd.default_schedule_id AND uro.user_id = sd.user_id AND uro.is_active = true
    LEFT JOIN current_user_prefs cup
      ON cup.user_id = sd.user_id
)
SELECT user_id, default_schedule_id, source_scope_type, default_name, reminder_key, reminder_type,
  app_environment, override_enabled, notifications_enabled, override_id, effective_name,
  effective_timezone, effective_start_time, effective_end_time, effective_days_of_week,
  effective_interval_minutes, effective_local_enabled, effective_remote_enabled,
  allow_user_override, grace_period_minutes, message_title, message_body,
  push_enabled, local_reminders_enabled, data_log_reminders, escalation_alerts,
  session_note_reminders, caregiver_messages, supervision_reminders, admin_alerts,
  quiet_hours_enabled, quiet_hours_start, quiet_hours_end, effective_enabled
FROM merged;

-- Fix pending_student_changes: replace overly permissive reviewer UPDATE
DROP POLICY IF EXISTS "Reviewers can update pending changes" ON public.pending_student_changes;

-- Reviewers = the requestor (already covered) or someone in the same agency
CREATE POLICY "Agency members can review pending changes"
  ON public.pending_student_changes FOR UPDATE TO authenticated
  USING (
    requested_by = auth.uid()
    OR reviewed_by = auth.uid()
  );
