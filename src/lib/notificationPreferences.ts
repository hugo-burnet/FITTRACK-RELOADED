/**
 * Which of the three notifications the app is allowed to post — RF-53.
 *
 * The requirement says *individually*: the bell at the end of a rest, the
 * reminder that a training day has come, and the record that has just fallen
 * are three different intrusions, and somebody who wants the first does not
 * necessarily want the third. One switch each, therefore, and never a single
 * "notifications" master switch that turns the useful one off with the rest.
 *
 * Pure by construction (architecture §7): the defaults and the reading of an
 * untrusted stored value live here, the Dexie door lives in
 * `data/repositories/notificationSettings`.
 */

import {
  DEFAULT_REMINDER_SCHEDULE,
  normalizeReminderSchedule,
  type ReminderSchedule,
} from './reminders';

export interface NotificationPreferences {
  /** The scheduled "it is a training day" reminder. */
  reminders: boolean;
  /** The end of a rest, scheduled while the screen is off. */
  rest: boolean;
  /** A personal record, the moment it is persisted. */
  records: boolean;
  schedule: ReminderSchedule;
}

/**
 * Rest and records on, reminders off.
 *
 * The first two answer something the user just did — they are the app speaking
 * when spoken to. A reminder speaks on a day you did not open the app, which is
 * exactly the notification nobody installed the app to receive: it is offered,
 * never assumed. Turning it on is one switch away in Réglages.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  reminders: false,
  rest: true,
  records: true,
  schedule: DEFAULT_REMINDER_SCHEDULE,
};

function readFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const stored = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >;

  return {
    reminders: readFlag(stored.reminders, DEFAULT_NOTIFICATION_PREFERENCES.reminders),
    rest: readFlag(stored.rest, DEFAULT_NOTIFICATION_PREFERENCES.rest),
    records: readFlag(stored.records, DEFAULT_NOTIFICATION_PREFERENCES.records),
    schedule: normalizeReminderSchedule(stored.schedule),
  };
}

/**
 * True when the schedule can actually make a reminder happen.
 *
 * The switch and the week are two different pieces of state, and one of them
 * can quietly cancel the other: reminders "on" with no day checked never rings.
 * The screen says so rather than leaving the switch to look like it works.
 */
export function remindersArmed(preferences: NotificationPreferences): boolean {
  return preferences.reminders && preferences.schedule.days.length > 0;
}
