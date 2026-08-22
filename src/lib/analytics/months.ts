import { localDateKey, localOffsetMinutes } from '@/lib/timezone';

/**
 * Calendar months, for the one reading that weeks cannot give — RF-44.
 *
 * The whole analytics floor counts in weeks, and it is right to: a training
 * week is the unit a split repeats on. A *report*, though, is read against a
 * calendar — "juillet", not "les semaines 27 à 31" — and no whole number of
 * weeks makes a month. Hence this module, built exactly like `weeks.ts`, on
 * local civil components rather than on elapsed durations.
 *
 * Pure by construction (architecture §7).
 */

/** The first of the month, at local midnight. */
export function startOfLocalMonth(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
}

/**
 * Months added by the calendar, never by `30 × 24 h`.
 *
 * `new Date(year, month + amount, 1)` normalizes an out-of-range month on its
 * own — month 12 is January of the next year — and it lands on the wall clock
 * whatever daylight saving did in between.
 */
export function addLocalMonths(monthStart: number, amount: number): number {
  const date = new Date(monthStart);
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 0, 0, 0, 0).getTime();
}

/**
 * The month a session belongs to, judged in **its own** offset.
 *
 * Same three steps and the same reason as `weekStartOf`: a session logged at
 * 23:30 on the 31st must not move to the next month because it is being read
 * from another time zone, and noon never slides on a daylight-saving day.
 */
export function monthStartOf(startedAt: number, offsetMinutes?: number): number {
  const offset = offsetMinutes ?? localOffsetMinutes(startedAt);
  const [year, month, day] = localDateKey(startedAt, offset).split('-').map(Number);
  return startOfLocalMonth(new Date(year!, month! - 1, day!, 12).getTime());
}

/**
 * Every month from the oldest observed one to the month `now` falls in,
 * **newest first** — the order a report is read in.
 *
 * Continuous, so a month without a single session appears in the list rather
 * than being skipped: "je n'ai rien fait en juillet" is a reading, and a list
 * that silently jumps from juin to août is a list that hides it. Same rule as
 * `knownWeekStarts`, whose internal empty weeks are data.
 */
export function knownMonthStarts(
  observedMonthStarts: Iterable<number>,
  now: number,
): number[] {
  const observed = [...observedMonthStarts];
  if (observed.length === 0) return [];

  const oldest = startOfLocalMonth(Math.min(...observed));
  const current = startOfLocalMonth(now);
  const months: number[] = [];

  for (let month = current; month >= oldest; month = addLocalMonths(month, -1)) {
    months.push(month);
  }

  return months;
}
