import { LocalNotifications } from '@capacitor/local-notifications';
import { t } from '@/i18n/fr';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  remindersArmed,
  type NotificationPreferences,
} from '@/lib/notificationPreferences';
import { nextReminderOccurrences } from '@/lib/reminders';
import type { RestTimer } from '@/stores/restTimer';
import { isNativeAndroid } from './nativeEnvironment';

export type NotificationPlugin = Pick<
  typeof LocalNotifications,
  | 'checkPermissions'
  | 'requestPermissions'
  | 'checkExactNotificationSetting'
  | 'changeExactNotificationSetting'
  | 'createChannel'
  | 'schedule'
  | 'cancel'
>;

export const WORKOUT_NOTIFICATION_ID = 41001;
export const REST_NOTIFICATION_ID = 41002;
/**
 * One id for every record: a second record replaces the first in the shade.
 *
 * Three categories can fall on the same set, and three lines saying "record
 * battu" one under the other is a notification drawer to clear, not news. The
 * card in the session is where the detail lives (`RecordNote`); this is the
 * trace you find later, and the last one is the one worth finding.
 */
export const RECORD_NOTIFICATION_ID = 41003;
/** Reminders occupy `BASE … BASE + REMINDER_HORIZON - 1`, and nothing else. */
export const REMINDER_NOTIFICATION_BASE_ID = 41100;
export const WORKOUT_CHANNEL_ID = 'fittrack-workout';
export const REST_CHANNEL_ID = 'fittrack-rest';
export const RECORD_CHANNEL_ID = 'fittrack-record';
export const REMINDER_CHANNEL_ID = 'fittrack-reminder';

/**
 * How many reminders are armed ahead — four weeks of a three-day week.
 *
 * The app re-arms the list at every launch and at every change of the schedule,
 * so the horizon only has to outlive the longest plausible silence: a phone
 * that has not opened FitTrack for a month has stopped needing a reminder and
 * needs a decision instead.
 */
export const REMINDER_HORIZON = 12;

interface NativeNotificationGateway {
  reconcileWorkout: (name: string | null) => Promise<void>;
  reconcileRest: (rest: RestTimer) => Promise<void>;
  /**
   * Hands one rest back to the app: the in-app countdown proved it is audible,
   * so the scheduled alert would only be a second bell one beat behind — and,
   * on Android, the one bell that ducks the music instead of mixing with it.
   */
  standDownRest: (endsAt: number) => Promise<void>;
  /**
   * The three switches of RF-53, and the week the reminder rings on.
   *
   * Called with what the database holds, at launch and at every change: the
   * gateway never reads Dexie itself, and never keeps a preference of its own
   * that the settings screen could contradict.
   */
  applyPreferences: (preferences: NotificationPreferences, now?: number) => Promise<void>;
  /** Posts one record, now — the copy is the caller's, the channel is ours. */
  notifyRecord: (notice: { title: string; body: string }) => Promise<void>;
  clearAll: () => Promise<void>;
  isRestAlertArmed: () => boolean;
}

export function createNativeNotificationGateway(
  plugin: NotificationPlugin,
  isAndroid: () => boolean,
  onError: (error: unknown) => void,
): NativeNotificationGateway {
  let readyPromise: Promise<boolean> | null = null;
  let exactSettingOpened = false;
  let queue = Promise.resolve();
  let lastWorkoutName: string | null = null;
  let lastRestEndsAt = 0;
  let restAlertArmed = false;
  /** The one deadline the app has taken over. Never re-armed behind its back. */
  let standDownEndsAt = 0;
  let preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;

  async function initialize(): Promise<boolean> {
    try {
      const currentPermission = await plugin.checkPermissions();
      const permission =
        currentPermission.display === 'granted'
          ? currentPermission
          : await plugin.requestPermissions();

      if (permission.display !== 'granted') return false;

      await plugin.createChannel({
        id: WORKOUT_CHANNEL_ID,
        name: t('androidNotification.workoutChannel'),
        description: t('androidNotification.workoutChannelDescription'),
        importance: 2,
        visibility: 0,
        vibration: false,
      });
      await plugin.createChannel({
        id: REST_CHANNEL_ID,
        name: t('androidNotification.restChannel'),
        description: t('androidNotification.restChannelDescription'),
        importance: 4,
        visibility: 1,
        vibration: true,
      });
      // Importance 2 — visible, never audible. A record falls at the exact
      // moment a set is validated, phone in hand: the app has already said so
      // in the card and, if the announcer is on, out loud through Web Audio.
      // A system sound here would be the one bell of the whole app that ducks
      // the music (cf. Lot 21), to say something already said.
      await plugin.createChannel({
        id: RECORD_CHANNEL_ID,
        name: t('androidNotification.recordChannel'),
        description: t('androidNotification.recordChannelDescription'),
        importance: 2,
        visibility: 1,
        vibration: false,
      });
      // Importance 4 — this one has to interrupt: it rings on a day the app was
      // not opened, which is the whole point of a reminder.
      await plugin.createChannel({
        id: REMINDER_CHANNEL_ID,
        name: t('androidNotification.reminderChannel'),
        description: t('androidNotification.reminderChannelDescription'),
        importance: 4,
        visibility: 1,
        vibration: true,
      });

      const exactPermission = await plugin.checkExactNotificationSetting();
      if (exactPermission.exact_alarm !== 'granted' && !exactSettingOpened) {
        exactSettingOpened = true;
        await plugin.changeExactNotificationSetting();
      }

      return true;
    } catch (error) {
      onError(error);
      return false;
    }
  }

  function ensureReady(): Promise<boolean> {
    if (!isAndroid()) return Promise.resolve(false);
    if (readyPromise) return readyPromise;

    const pending = initialize();
    readyPromise = pending;
    void pending.then((ready) => {
      if (!ready && readyPromise === pending) readyPromise = null;
    });
    return pending;
  }

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const run = queue.then(operation, operation);
    queue = run.catch(onError);
    return queue;
  }

  function cancel(ids: number[]): Promise<void> {
    return plugin.cancel({ notifications: ids.map((id) => ({ id })) });
  }

  return {
    reconcileWorkout(name) {
      return enqueue(async () => {
        if (!isAndroid()) return;

        if (name === null) {
          await cancel([WORKOUT_NOTIFICATION_ID, REST_NOTIFICATION_ID]);
          lastWorkoutName = null;
          lastRestEndsAt = 0;
          restAlertArmed = false;
          return;
        }

        const title = name.trim() || t('workout.emptyName');
        if (lastWorkoutName === title) return;
        if (!(await ensureReady())) return;

        await plugin.schedule({
          notifications: [
            {
              id: WORKOUT_NOTIFICATION_ID,
              title,
              body: t('androidNotification.workoutBody'),
              channelId: WORKOUT_CHANNEL_ID,
              ongoing: true,
              autoCancel: false,
            },
          ],
        });
        lastWorkoutName = title;
      });
    },

    reconcileRest(rest) {
      return enqueue(async () => {
        if (!isAndroid()) return;
        // Switch off: nothing to arm, and nothing to cancel either — the branch
        // below already ran the last time the timer stopped.
        if (!preferences.rest && rest.setId !== null) return;

        if (rest.setId === null) {
          if (lastRestEndsAt > Date.now()) await cancel([REST_NOTIFICATION_ID]);
          lastRestEndsAt = 0;
          restAlertArmed = false;
          standDownEndsAt = 0;
          return;
        }

        // A re-render must not resurrect the notification the countdown just
        // cancelled: the deadline it stood down for stays stood down.
        if (rest.endsAt === standDownEndsAt) return;
        if (rest.endsAt === lastRestEndsAt && restAlertArmed) return;
        if (!(await ensureReady())) {
          restAlertArmed = false;
          return;
        }

        restAlertArmed = false;
        lastRestEndsAt = 0;
        await cancel([REST_NOTIFICATION_ID]);
        await plugin.schedule({
          notifications: [
            {
              id: REST_NOTIFICATION_ID,
              title: t('androidNotification.restTitle'),
              body: t('androidNotification.restBody'),
              channelId: REST_CHANNEL_ID,
              schedule: { at: new Date(rest.endsAt), allowWhileIdle: true },
              autoCancel: true,
            },
          ],
        });
        lastRestEndsAt = rest.endsAt;
        restAlertArmed = true;
      });
    },

    standDownRest(endsAt) {
      return enqueue(async () => {
        standDownEndsAt = endsAt;
        restAlertArmed = false;
        if (!isAndroid()) return;
        if (lastRestEndsAt !== endsAt) return;
        lastRestEndsAt = 0;
        await cancel([REST_NOTIFICATION_ID]);
      });
    },

    applyPreferences(next, now = Date.now()) {
      return enqueue(async () => {
        const previous = preferences;
        preferences = next;
        if (!isAndroid()) return;

        // A rest alert already in the air outlives the switch that armed it
        // unless it is taken down here: the session is running, the phone is in
        // a pocket, and nobody will come back to this screen to cancel it.
        if (previous.rest && !next.rest && restAlertArmed) {
          restAlertArmed = false;
          lastRestEndsAt = 0;
          await cancel([REST_NOTIFICATION_ID]);
        }

        const ids = Array.from(
          { length: REMINDER_HORIZON },
          (_, index) => REMINDER_NOTIFICATION_BASE_ID + index,
        );
        // Cancel first, always: the week may have lost a day, and a reminder
        // scheduled under the old schedule has no other chance of going away.
        await cancel(ids);
        if (!remindersArmed(next)) return;
        if (!(await ensureReady())) return;

        const occurrences = nextReminderOccurrences(next.schedule, now, REMINDER_HORIZON);
        if (occurrences.length === 0) return;

        await plugin.schedule({
          notifications: occurrences.map((at, index) => ({
            id: REMINDER_NOTIFICATION_BASE_ID + index,
            title: t('androidNotification.reminderTitle'),
            body: t('androidNotification.reminderBody'),
            channelId: REMINDER_CHANNEL_ID,
            schedule: { at: new Date(at), allowWhileIdle: true },
            autoCancel: true,
          })),
        });
      });
    },

    notifyRecord(notice) {
      return enqueue(async () => {
        if (!isAndroid() || !preferences.records) return;
        if (!(await ensureReady())) return;

        await plugin.schedule({
          notifications: [
            {
              id: RECORD_NOTIFICATION_ID,
              title: notice.title,
              body: notice.body,
              channelId: RECORD_CHANNEL_ID,
              autoCancel: true,
            },
          ],
        });
      });
    },

    clearAll() {
      return enqueue(async () => {
        if (!isAndroid()) return;
        await cancel([WORKOUT_NOTIFICATION_ID, REST_NOTIFICATION_ID]);
        lastWorkoutName = null;
        lastRestEndsAt = 0;
        restAlertArmed = false;
        standDownEndsAt = 0;
      });
    },

    isRestAlertArmed() {
      return restAlertArmed;
    },
  };
}

export const nativeNotifications = createNativeNotificationGateway(
  LocalNotifications,
  isNativeAndroid,
  console.error,
);
