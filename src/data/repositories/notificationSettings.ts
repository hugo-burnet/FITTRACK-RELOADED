import { db } from '@/data/db';
import {
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notificationPreferences';

/**
 * The door to the three notification switches and the reminder week — RF-53.
 *
 * One key rather than four: the three switches and the schedule are always read
 * together (the gateway needs the whole picture before it can decide what to
 * post), and a partial write of four keys is four chances to end up with a
 * reminder armed on a week that was never saved.
 *
 * It lives in `settings`, so it leaves with the backup and comes back with it —
 * a restored phone finds its reminders again without being told twice.
 */

const NOTIFICATION_PREFERENCES_KEY = 'notificationPreferences';

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const setting = await db.settings.get(NOTIFICATION_PREFERENCES_KEY);
  return normalizeNotificationPreferences(setting?.value);
}

/**
 * Writes what changed, keeps the rest.
 *
 * Read-modify-write inside one transaction: the settings screen flips one
 * switch at a time, and two taps in the same second must not have the second
 * one save a picture taken before the first.
 */
export async function setNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return db.transaction('rw', db.settings, async () => {
    const current = await getNotificationPreferences();
    const next = normalizeNotificationPreferences({ ...current, ...patch });

    await db.settings.put({
      key: NOTIFICATION_PREFERENCES_KEY,
      value: next,
      updatedAt: Date.now(),
    });

    return next;
  });
}
