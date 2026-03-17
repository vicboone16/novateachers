/**
 * Local Reminder Scheduling Engine.
 * Reads effective_user_reminders from Supabase and schedules
 * Capacitor local notifications for fixed_time and interval reminders.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  scheduleLocalNotification,
  cancelAllLocalNotifications,
  getPendingLocalNotifications,
} from '@/lib/push';
import { NOTIFICATION_LABELS, resolveNotificationKey } from '@/lib/notifications';
import type { NotificationKey } from '@/lib/notifications';

export interface EffectiveReminder {
  default_schedule_id: string;
  reminder_key: string;
  reminder_type: string;
  effective_name: string;
  effective_enabled: boolean;
  effective_local_enabled: boolean;
  effective_remote_enabled: boolean;
  effective_start_time: string | null;
  effective_end_time: string | null;
  effective_days_of_week: number[] | null;
  effective_interval_minutes: number | null;
  effective_timezone: string | null;
  message_title: string | null;
  message_body: string | null;
  source_scope_type: string | null;
  override_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

/**
 * Fetch effective reminders for the current user from the view.
 */
export async function fetchEffectiveReminders(): Promise<EffectiveReminder[]> {
  const { data, error } = await (supabase as any)
    .from('effective_user_reminders')
    .select('*');

  if (error) {
    console.error('[ReminderScheduler] Failed to fetch effective reminders:', error);
    return [];
  }
  return (data || []) as EffectiveReminder[];
}

/**
 * Compute the next fire time for a reminder based on its type and schedule.
 */
export function computeNextFireTime(reminder: EffectiveReminder): Date | null {
  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon..7=Sun

  // Check if today is an allowed day
  const allowedDays = reminder.effective_days_of_week;
  if (allowedDays && allowedDays.length > 0 && !allowedDays.includes(todayDow)) {
    // Find the next allowed day
    for (let offset = 1; offset <= 7; offset++) {
      const checkDow = ((todayDow - 1 + offset) % 7) + 1;
      if (allowedDays.includes(checkDow)) {
        const next = new Date(now);
        next.setDate(next.getDate() + offset);
        if (reminder.effective_start_time) {
          const [h, m] = reminder.effective_start_time.split(':').map(Number);
          next.setHours(h, m, 0, 0);
        } else {
          next.setHours(8, 0, 0, 0);
        }
        return next;
      }
    }
    return null;
  }

  if (reminder.reminder_type === 'fixed_time' && reminder.effective_start_time) {
    const [h, m] = reminder.effective_start_time.split(':').map(Number);
    const fireTime = new Date(now);
    fireTime.setHours(h, m, 0, 0);
    if (fireTime <= now) {
      // Already passed today, schedule for tomorrow (or next allowed day)
      fireTime.setDate(fireTime.getDate() + 1);
    }
    return fireTime;
  }

  if (reminder.reminder_type === 'interval' && reminder.effective_interval_minutes) {
    const intervalMs = reminder.effective_interval_minutes * 60 * 1000;

    // If we have a start/end window, respect it
    if (reminder.effective_start_time && reminder.effective_end_time) {
      const [sh, sm] = reminder.effective_start_time.split(':').map(Number);
      const [eh, em] = reminder.effective_end_time.split(':').map(Number);
      const windowStart = new Date(now);
      windowStart.setHours(sh, sm, 0, 0);
      const windowEnd = new Date(now);
      windowEnd.setHours(eh, em, 0, 0);

      if (now < windowStart) {
        return windowStart;
      }
      if (now >= windowEnd) {
        // Schedule for tomorrow's window start
        const tomorrow = new Date(windowStart);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
      // Within window: next interval from now
      return new Date(now.getTime() + intervalMs);
    }

    // No window: just schedule from now
    return new Date(now.getTime() + intervalMs);
  }

  if (reminder.reminder_type === 'session_close' && reminder.effective_end_time) {
    const [h, m] = reminder.effective_end_time.split(':').map(Number);
    const fireTime = new Date(now);
    fireTime.setHours(h, m, 0, 0);
    if (fireTime <= now) {
      fireTime.setDate(fireTime.getDate() + 1);
    }
    return fireTime;
  }

  // block_based and missing_data_followup are handled remotely
  return null;
}

/**
 * Check if a time falls within quiet hours.
 */
function isInQuietHours(time: Date, reminder: EffectiveReminder): boolean {
  if (!reminder.quiet_hours_enabled || !reminder.quiet_hours_start || !reminder.quiet_hours_end) {
    return false;
  }
  const [qsh, qsm] = reminder.quiet_hours_start.split(':').map(Number);
  const [qeh, qem] = reminder.quiet_hours_end.split(':').map(Number);
  const h = time.getHours();
  const m = time.getMinutes();
  const timeMinutes = h * 60 + m;
  const startMinutes = qsh * 60 + qsm;
  const endMinutes = qeh * 60 + qem;

  if (startMinutes < endMinutes) {
    // Same day quiet hours (e.g. 13:00-15:00)
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  } else {
    // Overnight quiet hours (e.g. 22:00-07:00)
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  }
}

/**
 * Generate a stable numeric ID for a reminder (for Capacitor local notifications).
 */
function reminderNotificationId(scheduleId: string, index: number): number {
  // Use a hash of the schedule ID to generate a stable int
  let hash = 0;
  for (let i = 0; i < scheduleId.length; i++) {
    hash = ((hash << 5) - hash + scheduleId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + index;
}

/**
 * Rebuild all local reminder schedules.
 * Call this when the user updates notification preferences or overrides.
 */
export async function rebuildLocalSchedules(): Promise<{
  scheduled: number;
  skipped: number;
  reminders: Array<{ key: string; name: string; nextFire: Date | null; source: string }>;
}> {
  console.log('[ReminderScheduler] Rebuilding local schedules…');

  // Cancel all existing local notifications first
  await cancelAllLocalNotifications();

  const reminders = await fetchEffectiveReminders();
  let scheduled = 0;
  let skipped = 0;
  const results: Array<{ key: string; name: string; nextFire: Date | null; source: string }> = [];

  for (const r of reminders) {
    const resolvedKey = resolveNotificationKey(r.reminder_key);
    const source = r.override_enabled ? 'override' : (r.source_scope_type || 'platform');

    // Skip disabled or remote-only reminders
    if (!r.effective_enabled || !r.effective_local_enabled) {
      results.push({ key: resolvedKey, name: r.effective_name, nextFire: null, source });
      skipped++;
      continue;
    }

    // Skip types that are handled remotely
    if (r.reminder_type === 'missing_data_followup' || r.reminder_type === 'block_based') {
      results.push({ key: resolvedKey, name: r.effective_name, nextFire: null, source: source + ' (remote)' });
      skipped++;
      continue;
    }

    const nextFire = computeNextFireTime(r);
    if (!nextFire) {
      results.push({ key: resolvedKey, name: r.effective_name, nextFire: null, source });
      skipped++;
      continue;
    }

    // Check quiet hours
    if (isInQuietHours(nextFire, r)) {
      results.push({ key: resolvedKey, name: r.effective_name, nextFire: null, source: source + ' (quiet)' });
      skipped++;
      continue;
    }

    const label = NOTIFICATION_LABELS[resolvedKey as NotificationKey] || r.effective_name;
    const notifId = reminderNotificationId(r.default_schedule_id, 0);

    await scheduleLocalNotification({
      id: notifId,
      title: r.message_title || label,
      body: r.message_body || `${label} — tap to take action.`,
      scheduleAt: nextFire,
    });

    results.push({ key: resolvedKey, name: r.effective_name, nextFire, source });
    scheduled++;
  }

  console.log(`[ReminderScheduler] Scheduled ${scheduled}, skipped ${skipped}`);
  return { scheduled, skipped, reminders: results };
}

/**
 * Get a summary of current reminder state without rebuilding.
 */
export async function getReminderSummary(): Promise<
  Array<{ key: string; name: string; nextFire: Date | null; source: string; enabled: boolean; type: string }>
> {
  const reminders = await fetchEffectiveReminders();
  return reminders.map((r) => {
    const resolvedKey = resolveNotificationKey(r.reminder_key);
    const source = r.override_enabled ? 'override' : (r.source_scope_type || 'platform');
    const nextFire = r.effective_enabled && r.effective_local_enabled ? computeNextFireTime(r) : null;
    return {
      key: resolvedKey,
      name: r.effective_name,
      nextFire,
      source,
      enabled: r.effective_enabled,
      type: r.reminder_type,
    };
  });
}
