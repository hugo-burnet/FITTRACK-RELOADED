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
 * One bucket per week of the window — **including the empty ones, but never
 * before the history itself starts**.
 *
 * Milestone G1's rule turned around, and the reversal is the point: a week with
 * no session is not a missing reading, it is a week nobody trained. Hence the
 * structural consequence — **the buckets come from the period, not from the
 * sessions.**
 *
 * But only as far back as there is history, and that qualification was missing
 * from the first cut. Reported from use: three weeks of real history drew nine
 * empty bars in front of themselves. **Before the first recorded session a zero
 * is not a week without training — it is a week the app knows nothing about**,
 * which is exactly the invented zero G1 forbids, and it flattens the real bars
 * to make room for nothing.
 *
 * So the caller says whether any session predates the window. It cannot be
 * derived here: `sessions` holds only what the window returned, and "no session
 * before the window" and "no session in the window" are indistinguishable from
 * the inside. A gap *inside* the history stays — that one is information.
 *
 * For `'all'` (no lower bound) the buckets start at the oldest session's week,
 * which is the same rule stated for the widest window, and why an empty history
 * returns an empty array rather than inventing a birthday for the app.
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

  const oldest = counts.size === 0 ? undefined : Math.min(...counts.keys());
  // The window's own start only wins when history reaches back past it.
  const first = bounds.from !== undefined && hasEarlierHistory ? bounds.from : oldest;
  if (first === undefined) return [];

  const buckets: WeekBucket[] = [];
  // Stepped week by week rather than divided by 604 800 000: a week is not
  // always 168 hours long, twice a year.
  for (let week = startOfLocalWeek(first); week < bounds.to; week = addLocalWeeks(week, 1)) {
    buckets.push({
      weekStart: week,
      sessions: counts.get(week) ?? 0,
      goal: resolveWeeklyGoal(goals, week),
    });
  }

  return buckets;
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
