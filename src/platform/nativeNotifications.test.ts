import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/fr';
import type { RestTimer } from '@/stores/restTimer';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notificationPreferences';
import {
  createNativeNotificationGateway,
  RECORD_CHANNEL_ID,
  RECORD_NOTIFICATION_ID,
  REMINDER_CHANNEL_ID,
  REMINDER_HORIZON,
  REMINDER_NOTIFICATION_BASE_ID,
  REST_CHANNEL_ID,
  REST_NOTIFICATION_ID,
  WORKOUT_CHANNEL_ID,
  WORKOUT_NOTIFICATION_ID,
  type NotificationPlugin,
} from './nativeNotifications';

function createPlugin(): NotificationPlugin {
  return {
    checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    checkExactNotificationSetting: vi.fn().mockResolvedValue({ exact_alarm: 'granted' }),
    changeExactNotificationSetting: vi.fn().mockResolvedValue({ exact_alarm: 'granted' }),
    createChannel: vi.fn().mockResolvedValue(undefined),
    schedule: vi.fn().mockResolvedValue({ notifications: [] }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
}

function activeRest(endsAt: number, setId = 'set-1'): RestTimer {
  return { setId, startedAt: endsAt - 90_000, endsAt, seconds: 90 };
}

const idleRest: RestTimer = { setId: null, startedAt: 0, endsAt: 0, seconds: 0 };

describe('native notification gateway', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('does not call the plugin outside native Android', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => false, vi.fn());

    await gateway.reconcileWorkout('Lower A');
    await gateway.reconcileRest(activeRest(Date.now() + 90_000));
    await gateway.clearAll();

    expect(plugin.checkPermissions).not.toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.cancel).not.toHaveBeenCalled();
  });

  it('requests display permission before creating notifications', async () => {
    const plugin = createPlugin();
    vi.mocked(plugin.checkPermissions).mockResolvedValue({ display: 'prompt' });
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileWorkout('Lower A');

    expect(plugin.requestPermissions).toHaveBeenCalledOnce();
    // Les quatre canaux de RF-53 : séance, repos, record, rappel.
    expect(plugin.createChannel).toHaveBeenCalledTimes(4);
    expect(plugin.schedule).toHaveBeenCalledOnce();
  });

  it('does not schedule when display permission remains denied', async () => {
    const plugin = createPlugin();
    vi.mocked(plugin.checkPermissions).mockResolvedValue({ display: 'denied' });
    vi.mocked(plugin.requestPermissions).mockResolvedValue({ display: 'denied' });
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileWorkout('Lower A');

    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.createChannel).not.toHaveBeenCalled();
  });

  it('opens the exact-alarm setting once when exact alarms are denied', async () => {
    const plugin = createPlugin();
    vi.mocked(plugin.checkExactNotificationSetting).mockResolvedValue({ exact_alarm: 'denied' });
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileWorkout('Lower A');
    await gateway.reconcileRest(activeRest(Date.now() + 90_000));

    expect(plugin.changeExactNotificationSetting).toHaveBeenCalledOnce();
  });

  it('contains plugin failures and reports them through onError', async () => {
    const plugin = createPlugin();
    const error = new Error('native failure');
    const onError = vi.fn();
    vi.mocked(plugin.checkPermissions).mockRejectedValue(error);
    const gateway = createNativeNotificationGateway(plugin, () => true, onError);

    await expect(gateway.reconcileWorkout('Lower A')).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('shows one silent ongoing notification for an active workout', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileWorkout('Lower A');

    expect(plugin.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: WORKOUT_CHANNEL_ID,
        importance: 2,
        visibility: 0,
        vibration: false,
      }),
    );
    expect(plugin.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: WORKOUT_NOTIFICATION_ID,
          title: 'Lower A',
          body: t('androidNotification.workoutBody'),
          channelId: WORKOUT_CHANNEL_ID,
          ongoing: true,
          autoCancel: false,
        }),
      ],
    });
  });

  it('uses the free-workout fallback when the name is empty', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileWorkout('  ');

    expect(plugin.schedule).toHaveBeenCalledWith({
      notifications: [expect.objectContaining({ title: t('workout.emptyName') })],
    });
  });

  it('removes the ongoing and rest notifications when no workout is active', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileWorkout(null);

    expect(plugin.cancel).toHaveBeenCalledWith({
      notifications: [{ id: WORKOUT_NOTIFICATION_ID }, { id: REST_NOTIFICATION_ID }],
    });
  });

  it('is idempotent for repeated active workout reconciliation', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileWorkout('Lower A');
    await gateway.reconcileWorkout('Lower A');

    expect(plugin.schedule).toHaveBeenCalledOnce();
  });

  it('schedules the rest at endsAt with allowWhileIdle', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    const endsAt = Date.now() + 90_000;

    await gateway.reconcileRest(activeRest(endsAt));

    expect(plugin.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: REST_CHANNEL_ID,
        importance: 4,
        visibility: 1,
        vibration: true,
      }),
    );
    expect(plugin.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: REST_NOTIFICATION_ID,
          title: t('androidNotification.restTitle'),
          body: t('androidNotification.restBody'),
          channelId: REST_CHANNEL_ID,
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
          autoCancel: true,
        }),
      ],
    });
  });

  it('cancels a future rest when the timer stops', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T18:00:00Z'));
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileRest(activeRest(Date.now() + 90_000));
    await gateway.reconcileRest(idleRest);

    expect(plugin.cancel).toHaveBeenLastCalledWith({
      notifications: [{ id: REST_NOTIFICATION_ID }],
    });
    expect(gateway.isRestAlertArmed()).toBe(false);
  });

  it('does not dismiss an already delivered rest when the grace period clears the store', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T18:00:00Z'));
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    const endsAt = Date.now() + 1_000;

    await gateway.reconcileRest(activeRest(endsAt));
    vi.setSystemTime(endsAt + 1_500);
    vi.mocked(plugin.cancel).mockClear();
    await gateway.reconcileRest(idleRest);

    expect(plugin.cancel).not.toHaveBeenCalled();
  });

  it('serializes rapid replacement so the newest rest wins', async () => {
    const plugin = createPlugin();
    const releases: Array<() => void> = [];
    vi.mocked(plugin.schedule).mockImplementation(
      () => new Promise((resolve) => releases.push(() => resolve({ notifications: [] }))),
    );
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    const firstEndsAt = Date.now() + 60_000;
    const secondEndsAt = Date.now() + 120_000;

    const first = gateway.reconcileRest(activeRest(firstEndsAt));
    const second = gateway.reconcileRest(activeRest(secondEndsAt, 'set-2'));
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    releases[0]!();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases[1]!();
    await Promise.all([first, second]);

    const scheduled = vi
      .mocked(plugin.schedule)
      .mock.calls.map(([options]) => options.notifications[0]?.schedule?.at?.getTime());
    expect(scheduled).toEqual([firstEndsAt, secondEndsAt]);
    expect(gateway.isRestAlertArmed()).toBe(true);
  });

  it('marks native alert armed only after schedule succeeds', async () => {
    const plugin = createPlugin();
    let release = (): void => undefined;
    vi.mocked(plugin.schedule).mockImplementation(
      () => new Promise((resolve) => (release = () => resolve({ notifications: [] }))),
    );
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    const pending = gateway.reconcileRest(activeRest(Date.now() + 90_000));
    await vi.waitFor(() => expect(plugin.schedule).toHaveBeenCalledOnce());
    expect(gateway.isRestAlertArmed()).toBe(false);
    release();
    await pending;

    expect(gateway.isRestAlertArmed()).toBe(true);
  });

  it('leaves the web fallback enabled when scheduling fails', async () => {
    const plugin = createPlugin();
    vi.mocked(plugin.schedule).mockRejectedValue(new Error('schedule failed'));
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileRest(activeRest(Date.now() + 90_000));

    expect(gateway.isRestAlertArmed()).toBe(false);
  });
  it('cancels the rest alert the in-app countdown took over', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    const endsAt = Date.now() + 90_000;

    await gateway.reconcileRest(activeRest(endsAt));
    vi.mocked(plugin.cancel).mockClear();
    await gateway.standDownRest(endsAt);

    expect(plugin.cancel).toHaveBeenCalledWith({
      notifications: [{ id: REST_NOTIFICATION_ID }],
    });
    expect(gateway.isRestAlertArmed()).toBe(false);
  });

  it('does not re-arm a rest it stood down', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    const endsAt = Date.now() + 90_000;

    await gateway.reconcileRest(activeRest(endsAt));
    await gateway.standDownRest(endsAt);
    vi.mocked(plugin.schedule).mockClear();
    await gateway.reconcileRest(activeRest(endsAt));

    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('arms the next rest normally after a stand-down', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    const endsAt = Date.now() + 90_000;

    await gateway.reconcileRest(activeRest(endsAt));
    await gateway.standDownRest(endsAt);
    await gateway.reconcileRest(idleRest);
    vi.mocked(plugin.schedule).mockClear();
    await gateway.reconcileRest(activeRest(endsAt + 120_000, 'set-2'));

    expect(plugin.schedule).toHaveBeenCalledOnce();
    expect(gateway.isRestAlertArmed()).toBe(true);
  });
});

describe('notification preferences — RF-53', () => {
  const week = { days: [1, 3, 5], minutes: 18 * 60 };

  beforeEach(() => {
    vi.useRealTimers();
  });

  it('never arms a rest alert while the rest switch is off', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.applyPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, rest: false });
    vi.mocked(plugin.schedule).mockClear();
    await gateway.reconcileRest(activeRest(Date.now() + 90_000));

    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(gateway.isRestAlertArmed()).toBe(false);
  });

  it('takes down the rest alert already in the air when the switch goes off', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.reconcileRest(activeRest(Date.now() + 90_000));
    expect(gateway.isRestAlertArmed()).toBe(true);
    vi.mocked(plugin.cancel).mockClear();
    await gateway.applyPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, rest: false });

    expect(plugin.cancel).toHaveBeenCalledWith({
      notifications: [{ id: REST_NOTIFICATION_ID }],
    });
    expect(gateway.isRestAlertArmed()).toBe(false);
  });

  it('says nothing about a record while the record switch is off', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.applyPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, records: false });
    await gateway.notifyRecord({ title: 'Record battu', body: 'Développé couché · 102,5 kg' });

    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('posts a record on its own silent channel, replacing the previous one', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.notifyRecord({ title: 'Record battu', body: 'Développé couché · 102,5 kg' });

    expect(plugin.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: RECORD_CHANNEL_ID, importance: 2, vibration: false }),
    );
    expect(plugin.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: RECORD_NOTIFICATION_ID,
          title: 'Record battu',
          body: 'Développé couché · 102,5 kg',
          channelId: RECORD_CHANNEL_ID,
        }),
      ],
    });
    // Pas d'horaire : un record est une nouvelle du moment, pas une alarme.
    expect(
      vi.mocked(plugin.schedule).mock.calls[0]?.[0].notifications[0]?.schedule,
    ).toBeUndefined();
  });

  it('arms the coming reminders when the schedule is on', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    const now = new Date(2026, 7, 24, 9, 0, 0, 0).getTime();

    await gateway.applyPreferences(
      { ...DEFAULT_NOTIFICATION_PREFERENCES, reminders: true, schedule: week },
      now,
    );

    const scheduled = vi.mocked(plugin.schedule).mock.calls.at(-1)?.[0].notifications ?? [];
    expect(scheduled).toHaveLength(REMINDER_HORIZON);
    expect(scheduled[0]).toEqual(
      expect.objectContaining({
        id: REMINDER_NOTIFICATION_BASE_ID,
        channelId: REMINDER_CHANNEL_ID,
        title: t('androidNotification.reminderTitle'),
        body: t('androidNotification.reminderBody'),
      }),
    );
    expect(scheduled[0]?.schedule?.at?.getTime()).toBe(new Date(2026, 7, 24, 18, 0).getTime());
    expect(scheduled.every((notification) => notification.schedule?.allowWhileIdle)).toBe(true);
  });

  it('cancels every reminder slot before re-arming, so a removed day goes away', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.applyPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      reminders: true,
      schedule: week,
    });
    vi.mocked(plugin.cancel).mockClear();
    vi.mocked(plugin.schedule).mockClear();
    await gateway.applyPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      reminders: false,
      schedule: week,
    });

    expect(plugin.cancel).toHaveBeenCalledWith({
      notifications: Array.from({ length: REMINDER_HORIZON }, (_, index) => ({
        id: REMINDER_NOTIFICATION_BASE_ID + index,
      })),
    });
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('arms nothing when the switch is on but the week is empty', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());

    await gateway.applyPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      reminders: true,
      schedule: { days: [], minutes: 600 },
    });

    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('leaves the phone alone outside native Android', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => false, vi.fn());

    await gateway.applyPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      reminders: true,
      schedule: week,
    });
    await gateway.notifyRecord({ title: 'Record battu', body: 'Développé couché' });

    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.cancel).not.toHaveBeenCalled();
  });
});
