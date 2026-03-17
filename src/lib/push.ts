/**
 * Capacitor Push Notification + Local Notification helpers.
 * Captures APNs tokens and schedules local reminders natively on iOS.
 */
import { supabase } from '@/integrations/supabase/client';

let PushNotifications: any = null;
let LocalNotifications: any = null;
let isNative = false;

async function loadPlugins() {
  try {
    const cap = await import('@capacitor/push-notifications');
    PushNotifications = cap.PushNotifications;
    const local = await import('@capacitor/local-notifications');
    LocalNotifications = local.LocalNotifications;
    isNative = true;
  } catch {
    isNative = false;
  }
}

const pluginReady = loadPlugins();

/**
 * Request push permission & register for APNs token.
 * Stores token in push_tokens table (new schema: device_token, app_environment).
 */
export async function registerPush(userId: string): Promise<string | null> {
  await pluginReady;
  if (!PushNotifications || !isNative) {
    console.log('[Push] Not on native platform, skipping registration');
    return null;
  }

  try {
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[Push] Permission not granted');
      return null;
    }

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener('registration', async (token: { value: string }) => {
        console.log('[Push] APNs token:', token.value);

        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

        await (supabase as any)
          .from('push_tokens')
          .upsert(
            {
              user_id: userId,
              device_token: token.value,
              platform: 'ios',
              app_environment: 'beta',
              timezone: tz,
              is_active: true,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'device_token,app_environment' }
          );

        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', (err: any) => {
        console.error('[Push] Registration error:', err);
        resolve(null);
      });
    });
  } catch (err) {
    console.warn('[Push] Registration failed:', err);
    return null;
  }
}

/**
 * Schedule a local notification at a specific time.
 */
export async function scheduleLocalNotification(opts: {
  id: number;
  title: string;
  body: string;
  scheduleAt: Date;
}): Promise<void> {
  await pluginReady;
  if (!LocalNotifications || !isNative) return;

  try {
    const permResult = await LocalNotifications.requestPermissions();
    if (permResult.display !== 'granted') return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: opts.id,
          title: opts.title,
          body: opts.body,
          schedule: { at: opts.scheduleAt },
          sound: 'default',
        },
      ],
    });
  } catch (err) {
    console.warn('[LocalNotification] Schedule failed:', err);
  }
}

/**
 * Cancel a scheduled local notification by ID.
 */
export async function cancelLocalNotification(id: number): Promise<void> {
  await pluginReady;
  if (!LocalNotifications || !isNative) return;

  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // Ignore
  }
}

/**
 * Get pending local notifications count.
 */
export async function getPendingLocalNotifications(): Promise<any[]> {
  await pluginReady;
  if (!LocalNotifications || !isNative) return [];
  try {
    const result = await LocalNotifications.getPending();
    return result.notifications || [];
  } catch {
    return [];
  }
}

/**
 * Cancel all pending local notifications.
 */
export async function cancelAllLocalNotifications(): Promise<void> {
  await pluginReady;
  if (!LocalNotifications || !isNative) return;
  try {
    const pending = await getPendingLocalNotifications();
    if (pending.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.map((n: any) => ({ id: n.id })) });
    }
  } catch {
    // Ignore
  }
}

export function isPushAvailable(): boolean {
  return isNative;
}
