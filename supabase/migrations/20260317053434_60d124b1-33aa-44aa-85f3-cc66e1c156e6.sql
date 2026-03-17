
-- Update the effective_user_reminders view to use role-neutral reminder keys
CREATE OR REPLACE VIEW public.effective_user_reminders AS
WITH current_user_prefs AS (
  SELECT
    np.user_id,
    np.push_enabled,
    np.local_reminders_enabled,
    np.teacher_log_reminders,
    np.escalation_alerts,
    np.note_completion_reminders,
    np.parent_messages,
    np.supervision_reminders,
    np.admin_alerts,
    np.quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end
  FROM public.notification_preferences np
),
candidate_defaults AS (
  SELECT
    auth.uid() AS user_id,
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
    row_number() OVER (
      PARTITION BY drs.reminder_key, drs.app_environment
      ORDER BY drs.scope_rank ASC, drs.created_at DESC
    ) AS rn
  FROM public.default_reminder_scope_rank drs
  WHERE
    drs.app_environment IN ('beta', 'production', 'development')
    AND (
      drs.scope_type = 'platform'
      OR (drs.scope_type = 'user' AND drs.owner_user_id = auth.uid())
    )
),
selected_defaults AS (
  SELECT * FROM candidate_defaults WHERE rn = 1
),
merged AS (
  SELECT
    sd.user_id,
    sd.default_schedule_id,
    sd.scope_type AS source_scope_type,
    sd.name AS default_name,
    sd.reminder_key,
    sd.reminder_type,
    sd.app_environment,
    coalesce(uro.override_enabled, false) AS override_enabled,
    coalesce(uro.notifications_enabled, true) AS notifications_enabled,
    uro.id AS override_id,
    CASE
      WHEN coalesce(uro.override_enabled, false) = true AND uro.custom_name IS NOT NULL
        THEN uro.custom_name
      ELSE sd.name
    END AS effective_name,
    CASE
      WHEN coalesce(uro.override_enabled, false) = true AND uro.custom_timezone IS NOT NULL
        THEN uro.custom_timezone
      ELSE sd.timezone
    END AS effective_timezone,
    CASE
      WHEN coalesce(uro.override_enabled, false) = true AND uro.custom_start_time IS NOT NULL
        THEN uro.custom_start_time
      ELSE sd.start_time
    END AS effective_start_time,
    CASE
      WHEN coalesce(uro.override_enabled, false) = true AND uro.custom_end_time IS NOT NULL
        THEN uro.custom_end_time
      ELSE sd.end_time
    END AS effective_end_time,
    CASE
      WHEN coalesce(uro.override_enabled, false) = true AND uro.custom_days_of_week IS NOT NULL
        THEN uro.custom_days_of_week
      ELSE sd.days_of_week
    END AS effective_days_of_week,
    CASE
      WHEN coalesce(uro.override_enabled, false) = true AND uro.custom_interval_minutes IS NOT NULL
        THEN uro.custom_interval_minutes
      ELSE sd.interval_minutes
    END AS effective_interval_minutes,
    CASE
      WHEN coalesce(uro.override_enabled, false) = true AND uro.local_enabled IS NOT NULL
        THEN uro.local_enabled
      ELSE sd.local_enabled
    END AS effective_local_enabled,
    CASE
      WHEN coalesce(uro.override_enabled, false) = true AND uro.remote_enabled IS NOT NULL
        THEN uro.remote_enabled
      ELSE sd.remote_enabled
    END AS effective_remote_enabled,
    sd.allow_user_override,
    sd.grace_period_minutes,
    sd.message_title,
    sd.message_body,
    cup.push_enabled,
    cup.local_reminders_enabled,
    cup.teacher_log_reminders,
    cup.escalation_alerts,
    cup.note_completion_reminders,
    cup.parent_messages,
    cup.supervision_reminders,
    cup.admin_alerts,
    cup.quiet_hours_enabled,
    cup.quiet_hours_start,
    cup.quiet_hours_end,
    CASE
      WHEN coalesce(uro.notifications_enabled, true) = false THEN false
      WHEN cup.push_enabled = false AND cup.local_reminders_enabled = false THEN false
      -- Map role-neutral keys to legacy notification_preferences columns
      WHEN sd.reminder_key = 'data_log_reminder' AND cup.teacher_log_reminders = false THEN false
      WHEN sd.reminder_key = 'escalation_alert' AND cup.escalation_alerts = false THEN false
      WHEN sd.reminder_key = 'session_note_reminder' AND cup.note_completion_reminders = false THEN false
      WHEN sd.reminder_key = 'caregiver_message' AND cup.parent_messages = false THEN false
      WHEN sd.reminder_key = 'supervision_reminder' AND cup.supervision_reminders = false THEN false
      WHEN sd.reminder_key = 'admin_alert' AND cup.admin_alerts = false THEN false
      ELSE true
    END AS effective_enabled
  FROM selected_defaults sd
  LEFT JOIN public.user_reminder_overrides uro
    ON uro.default_schedule_id = sd.default_schedule_id
   AND uro.user_id = sd.user_id
   AND uro.is_active = true
  LEFT JOIN current_user_prefs cup
    ON cup.user_id = sd.user_id
)
SELECT * FROM merged;
