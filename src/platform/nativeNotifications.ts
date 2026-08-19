import { LocalNotifications } from '@capacitor/local-notifications';
import { t } from '@/i18n/fr';
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
export const WORKOUT_CHANNEL_ID = 'fittrack-workout';
export const REST_CHANNEL_ID = 'fittrack-rest';

interface NativeNotificationGateway {
  reconcileWorkout: (name: string | null) => Promise<void>;
  reconcileRest: (rest: RestTimer) => Promise<void>;
  /**
   * Hands one rest back to the app: the in-app countdown proved it is audible,
   * so the scheduled alert would only be a second bell one beat behind — and,
   * on Android, the one bell that ducks the music instead of mixing with it.
   */
  standDownRest: (endsAt: number) => Promise<void>;
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
