/**
 * When the app is allowed to tap you on the shoulder — RF-53, the reminder half.
 *
 * Pure by construction (architecture §7): a schedule and an instant in,
 * timestamps out. Nothing here reads Dexie, nothing here writes French, and
 * nothing here knows that Android exists.
 *
 * **Wall clock, never elapsed hours.** A reminder set for 19:00 is set for
 * 19:00, including on the week that carries a daylight-saving change and is
 * therefore 169 hours long. So an occurrence is built from local calendar
 * components — year, month, day, hour, minute — and never by adding
 * `7 × 24 × 3600 × 1000` to the previous one. Same reasoning as
 * `addLocalWeeks` in `lib/history`, on a different unit.
 */

export interface ReminderSchedule {
  /** Local weekdays, `0` = Sunday … `6` = Saturday. Sorted, deduplicated. */
  days: number[];
  /** Minutes since local midnight, `0` … `1439`. */
  minutes: number;
}

/**
 * Three evenings a week, the shape of the most common split — and an hour late
 * enough to still be a reminder rather than a wake-up call. It is what the
 * switch turns on; from there the schedule is the user's.
 */
export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  days: [1, 3, 5],
  minutes: 18 * 60,
};

const MINUTES_PER_DAY = 24 * 60;
const DAYS_PER_WEEK = 7;

/**
 * The week as it is read in French: Monday first, Sunday last.
 *
 * `Date.getDay()` puts Sunday at 0 and nothing is going to change that, so the
 * translation between the storage order and the reading order happens once,
 * here, rather than in every screen that draws seven boxes.
 */
export const REMINDER_WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** A fresh copy, always: a default handed out by reference gets mutated once. */
function defaultSchedule(): ReminderSchedule {
  return { days: [...DEFAULT_REMINDER_SCHEDULE.days], minutes: DEFAULT_REMINDER_SCHEDULE.minutes };
}

/** A clock reading, in the unit a schedule is stored in. */
export function minutesOfDay(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

/** `18:00` — what an `<input type="time">` exchanges, both ways. */
export function reminderClockValue(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Reads a clock field back, and refuses everything else.
 *
 * `undefined` rather than a fallback: an empty or half-typed field must leave
 * the saved hour alone, not silently reset it to six in the evening under the
 * user's fingers.
 */
export function minutesFromClockValue(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;

  return minutesOfDay(hours, minutes);
}

function normalizeDays(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const days = new Set<number>();
  for (const day of value) {
    if (typeof day !== 'number' || !Number.isInteger(day)) continue;
    if (day < 0 || day > 6) continue;
    days.add(day);
  }

  return [...days].sort((left, right) => left - right);
}

function normalizeMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return DEFAULT_REMINDER_SCHEDULE.minutes;
  }
  if (value < 0 || value >= MINUTES_PER_DAY) return DEFAULT_REMINDER_SCHEDULE.minutes;
  return value;
}

/**
 * What comes back out of the database, made trustworthy.
 *
 * An empty week survives: unchecking every day is a decision, and rewriting it
 * as "three evenings" would put back reminders somebody just removed. Garbage
 * — no object, no day list at all — falls back to the default instead.
 */
export function normalizeReminderSchedule(value: unknown): ReminderSchedule {
  if (typeof value !== 'object' || value === null) return defaultSchedule();

  const days = normalizeDays((value as Record<string, unknown>).days);
  if (days === undefined) return defaultSchedule();

  return { days, minutes: normalizeMinutes((value as Record<string, unknown>).minutes) };
}

/**
 * The next `count` instants this schedule points at, strictly after `now`.
 *
 * Explicit occurrences rather than a repeating rule: the app re-arms them at
 * every launch and at every change of the schedule, so a list of dated alarms
 * is enough — and it is the only version whose result can be read in a test
 * without a phone. The instant equal to `now` is excluded, which is what keeps
 * a reminder that has just rung from being scheduled again for the same minute.
 */
export function nextReminderOccurrences(
  schedule: ReminderSchedule,
  now: number,
  count: number,
): number[] {
  if (schedule.days.length === 0 || count <= 0) return [];

  const occurrences: number[] = [];
  const today = new Date(now);
  const hours = Math.floor(schedule.minutes / 60);
  const minutes = schedule.minutes % 60;
  // Enough days to fill the list even when a single weekday is checked, plus
  // the one that today may not be able to offer any more.
  const horizon = (count + 1) * DAYS_PER_WEEK;

  for (let offset = 0; offset <= horizon && occurrences.length < count; offset += 1) {
    const day = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
      hours,
      minutes,
      0,
      0,
    );
    if (!schedule.days.includes(day.getDay())) continue;

    const at = day.getTime();
    if (at > now) occurrences.push(at);
  }

  return occurrences;
}
