import {
  addLocalWeeks,
  resolveWeeklyGoal,
  startOfLocalWeek,
  type WeeklyTrainingGoal,
} from '@/lib/history';
import { localDateKey, localOffsetMinutes } from '@/lib/timezone';
import type { PeriodBounds } from './periods';

/**
 * Sessions per local week — the histogram's whole arithmetic.
 *
 * Pure by construction (architecture §7). Nothing here reads Dexie and nothing
 * here writes French.
 *
 * **The regularity engine is Lot 07's, and it stays there.** `startOfLocalWeek`,
 * `addLocalWeeks` and `resolveWeeklyGoal` already know how to move between local
 * weeks across a DST boundary and which goal applied to a given week. This
 * module imports them; it does not restate them and it did not move them —
 * `lib/` is already THE pure layer, and regularity belongs no more to the charts
 * than to the history screen.
 */

/** One column of the chart, and one row of the list under it. */
export interface WeekBucket {
  /** Monday 00:00 in the reader's local calendar. */
  weekStart: number;
  sessions: number;
  /** The goal **that week** was held to. `null` when none applied yet. */
  goal: number | null;
}

/** A session, reduced to the two fields a week count needs. */
export interface WeeklySession {
  startedAt: number;
  /** `Workout.startedTimezoneOffsetMinutes` — absent before the v2 migration. */
  timezoneOffsetMinutes?: number;
}

/**
 * The week a session belongs to, judged in **its own** offset.
 *
 * A session logged at 23:30 must not change day — and therefore week — because
 * it is being read from somewhere else: the totals of a past week would depend
 * on where you are standing when you look at them. That policy is already
 * written in `lib/timezone.ts`; this is its first weekly consumer.
 *
 * Three steps, no new date arithmetic: the session's own civil day, that day
 * rebuilt **at noon** in the reader's calendar, then Lot 07's week start.
 *
 * Noon and not midnight: in some zones midnight does not exist on the day of a
 * daylight-saving jump, and `new Date(y, m, d)` then slides to the day before.
 * Noon never slides. Rebuilding in the reader's calendar is also what makes the
 * result land exactly on one of the buckets `weeklySessionCounts` enumerates —
 * without it, a session and its bucket would be expressed in two different
 * frames and would never meet.
 */
export function weekStartOf(startedAt: number, offsetMinutes?: number): number {
  const offset = offsetMinutes ?? localOffsetMinutes(startedAt);
  const [year, month, day] = localDateKey(startedAt, offset).split('-').map(Number);
  return startOfLocalWeek(new Date(year!, month! - 1, day!, 12).getTime());
}

/**
 * The local Monday starts the app knows well enough to render.
 *
 * `observedWeekStarts` supplies the weeks found in the selected window. When
 * history precedes a finite window (`hasEarlierHistory`), the range begins at
 * `bounds.from`; otherwise it begins at the oldest observed week, so an
 * unknown pre-history never becomes invented zeroes. With no observations
 * (including an empty `'all'` history), there is no known week to return.
 * `bounds.to` is exclusive. Enumeration uses the regularity engine's
 * `startOfLocalWeek` and `addLocalWeeks`, rather than a fixed duration, so it
 * remains safe across daylight-saving transitions.
 */
export function knownWeekStarts(
  observedWeekStarts: Iterable<number>,
  bounds: PeriodBounds,
  hasEarlierHistory = false,
): number[] {
  const observed = [...observedWeekStarts];
  const oldest = observed.length === 0 ? undefined : Math.min(...observed);
  const first = bounds.from !== undefined && hasEarlierHistory ? bounds.from : oldest;
  if (first === undefined) return [];

  const starts: number[] = [];
  for (
    let weekStart = startOfLocalWeek(first);
    weekStart < bounds.to;
    weekStart = addLocalWeeks(weekStart, 1)
  ) {
    starts.push(weekStart);
  }
  return starts;
}

/**
 * The weekly metric: count sessions in each known week and resolve that week's
 * historical goal. Week selection, including empty internal weeks, belongs to
 * `knownWeekStarts`.
 */
export function weeklySessionCounts(
  sessions: readonly WeeklySession[],
  bounds: PeriodBounds,
  goals: readonly WeeklyTrainingGoal[],
  /** Whether any completed session happened **before** `bounds.from`. */
  hasEarlierHistory = false,
): WeekBucket[] {
  const counts = new Map<number, number>();
  for (const session of sessions) {
    const week = weekStartOf(session.startedAt, session.timezoneOffsetMinutes);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }

  return knownWeekStarts(counts.keys(), bounds, hasEarlierHistory).map((weekStart) => ({
    weekStart,
    sessions: counts.get(weekStart) ?? 0,
    goal: resolveWeeklyGoal(goals, weekStart),
  }));
}

/**
 * Sessions per week over the window, empty weeks included.
 *
 * Skipping the empty ones would report "3 sessions a week" to someone who
 * trains every other week — which is the figure this screen exists to correct.
 */
export function weeklyAverage(buckets: readonly WeekBucket[]): number {
  if (buckets.length === 0) return 0;
  const total = buckets.reduce((sum, bucket) => sum + bucket.sessions, 0);
  return total / buckets.length;
}

/**
 * Weeks that met their goal, out of the weeks that **had** one.
 *
 * `judged` rather than `buckets.length`: a week with no applicable goal is not a
 * missed week, it is an unjudged one. Otherwise the screen announces "0 out of
 * 12" to someone who never chose a target.
 */
export function goalWeeksReached(buckets: readonly WeekBucket[]): {
  reached: number;
  judged: number;
} {
  let reached = 0;
  let judged = 0;

  for (const bucket of buckets) {
    if (bucket.goal === null) continue;
    judged += 1;
    if (bucket.sessions >= bucket.goal) reached += 1;
  }

  return { reached, judged };
}
