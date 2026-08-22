import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notificationPreferences';
import { resetDb } from '@/test/resetDb';
import {
  getNotificationPreferences,
  setNotificationPreferences,
} from './notificationSettings';

describe('notification preferences', () => {
  beforeEach(resetDb);

  it('opens on the defaults when nothing was ever saved', async () => {
    expect(await getNotificationPreferences()).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('keeps the other switches when one is flipped', async () => {
    await setNotificationPreferences({ records: false });
    const stored = await getNotificationPreferences();

    expect(stored.records).toBe(false);
    expect(stored.rest).toBe(true);
    expect(stored.schedule).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.schedule);
  });

  it('saves a week and reads it back as it was written', async () => {
    await setNotificationPreferences({
      reminders: true,
      schedule: { days: [2, 4], minutes: 7 * 60 + 15 },
    });

    expect((await getNotificationPreferences()).schedule).toEqual({
      days: [2, 4],
      minutes: 435,
    });
  });

  it('survives a setting corrupted by hand', async () => {
    await db.settings.put({
      key: 'notificationPreferences',
      value: { rest: 'oui', schedule: { days: [42], minutes: 9999 } },
      updatedAt: Date.now(),
    });

    expect(await getNotificationPreferences()).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      schedule: { days: [], minutes: DEFAULT_NOTIFICATION_PREFERENCES.schedule.minutes },
    });
  });

  it('hands back what it saved, so the caller never re-reads to know', async () => {
    expect(await setNotificationPreferences({ reminders: true })).toEqual(
      await getNotificationPreferences(),
    );
  });
});
