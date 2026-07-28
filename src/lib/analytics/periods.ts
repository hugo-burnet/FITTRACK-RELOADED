import { addLocalWeeks, startOfLocalWeek } from '@/lib/history';

/**
 * How far back a chart looks.
 *
 * Pure by construction (architecture §7): a key and an instant in, two bounds
 * out. The bounds feed `ExportScope`, so the charts read history through the
 * very queries the exports do — cf. the spec, §1.
 */

export const PERIOD_KEYS = ['4w', '12w', '26w', '52w', 'all'] as const;

export type PeriodKey = (typeof PERIOD_KEYS)[number];

const WEEKS: Record<Exclude<PeriodKey, 'all'>, number> = {
  '4w': 4,
  '12w': 12,
  '26w': 26,
  '52w': 52,
};

export interface PeriodBounds {
  /** Inclusive. Absent for `'all'` — no invented birthday for the app. */
  from?: number;
  /** Exclusive, the bounds `listHistoryDay` and `listExportSources` use. */
  to: number;
}

/**
 * Bounds that fall on **local week starts**, never on "28 × 24 hours ago".
 *
 * A period beginning last Tuesday at 14:00 cuts a week in half, so the first
 * point of the curve appears and disappears depending on what time of day the
 * screen is opened. `to` is the end of the current week rather than `now`, for
 * the same reason: two readings taken an hour apart must plot the same points.
 *
 * `startOfLocalWeek` and `addLocalWeeks` are Lot 07's, already tested across a
 * DST boundary — a week is not always 168 hours long.
 */
export function periodBounds(key: PeriodKey, now: number): PeriodBounds {
  const currentWeek = startOfLocalWeek(now);
  const to = addLocalWeeks(currentWeek, 1);

  if (key === 'all') return { to };

  // The current week counts as one of them: "4 semaines" means this one and the
  // three before it, which is how someone reads their own last month.
  return { from: addLocalWeeks(currentWeek, -(WEEKS[key] - 1)), to };
}
