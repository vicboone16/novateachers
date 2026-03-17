/**
 * Role-neutral notification key constants and utilities.
 * Shared across teacher, supervisor, agency, and independent-provider workflows.
 */

// ── Canonical notification keys ──
export const NOTIFICATION_KEYS = {
  DATA_LOG_REMINDER: 'data_log_reminder',
  ESCALATION_ALERT: 'escalation_alert',
  SESSION_NOTE_REMINDER: 'session_note_reminder',
  CAREGIVER_MESSAGE: 'caregiver_message',
  SUPERVISION_REMINDER: 'supervision_reminder',
  ADMIN_ALERT: 'admin_alert',
} as const;

export type NotificationKey = (typeof NOTIFICATION_KEYS)[keyof typeof NOTIFICATION_KEYS];

// ── Display labels (role-neutral) ──
export const NOTIFICATION_LABELS: Record<NotificationKey, string> = {
  data_log_reminder: 'Data Log Reminder',
  escalation_alert: 'Escalation Alert',
  session_note_reminder: 'Session Note Reminder',
  caregiver_message: 'Caregiver Message Alert',
  supervision_reminder: 'Supervision Reminder',
  admin_alert: 'Admin Alert',
};

// ── Category grouping ──
export const NOTIFICATION_CATEGORIES: Record<string, { label: string; keys: NotificationKey[] }> = {
  reminders: {
    label: 'Reminders',
    keys: ['data_log_reminder', 'session_note_reminder', 'supervision_reminder'],
  },
  alerts: {
    label: 'Alerts',
    keys: ['escalation_alert', 'caregiver_message', 'admin_alert'],
  },
};

// ── Legacy key mapping (for backward compat) ──
export const LEGACY_KEY_MAP: Record<string, NotificationKey> = {
  teacher_log_reminder: 'data_log_reminder',
  note_completion_reminder: 'session_note_reminder',
  parent_message: 'caregiver_message',
};

export function resolveNotificationKey(key: string): NotificationKey {
  return (LEGACY_KEY_MAP[key] as NotificationKey) || (key as NotificationKey);
}
