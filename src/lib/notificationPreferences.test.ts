import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  remindersArmed,
} from './notificationPreferences';
import { DEFAULT_REMINDER_SCHEDULE } from './reminders';

describe('normalizeNotificationPreferences', () => {
  it('opens on rest and records, never on a reminder nobody asked for', () => {
    expect(normalizeNotificationPreferences(undefined)).toEqual({
      reminders: false,
      rest: true,
      records: true,
      schedule: DEFAULT_REMINDER_SCHEDULE,
    });
  });

  it('keeps each switch on its own, one missing key at a time', () => {
    expect(normalizeNotificationPreferences({ records: false }).records).toBe(false);
    expect(normalizeNotificationPreferences({ records: false }).rest).toBe(true);
    expect(normalizeNotificationPreferences({ rest: false }).records).toBe(true);
  });

  it('ignores a value that is not a boolean rather than reading it as off', () => {
    expect(normalizeNotificationPreferences({ rest: 'oui' }).rest).toBe(true);
  });

  it('normalizes the week it carries', () => {
    expect(
      normalizeNotificationPreferences({ schedule: { days: [3, 3, 9], minutes: 420 } }).schedule,
    ).toEqual({ days: [3], minutes: 420 });
  });

  it('never hands back the shared default object', () => {
    const preferences = normalizeNotificationPreferences(null);
    preferences.schedule.days.push(6);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.schedule.days).toEqual([1, 3, 5]);
    expect(DEFAULT_REMINDER_SCHEDULE.days).toEqual([1, 3, 5]);
  });
});

describe('remindersArmed', () => {
  it('is false when the switch is off', () => {
    expect(
      remindersArmed({ ...DEFAULT_NOTIFICATION_PREFERENCES, reminders: false }),
    ).toBe(false);
  });

  it('is false when the switch is on but no day is checked', () => {
    expect(
      remindersArmed({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        reminders: true,
        schedule: { days: [], minutes: 600 },
      }),
    ).toBe(false);
  });

  it('is true when a day can actually come round', () => {
    expect(
      remindersArmed({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        reminders: true,
        schedule: { days: [2], minutes: 600 },
      }),
    ).toBe(true);
  });
});
