import type { MeasurementType } from '@/data/types';
import type { HistoricalSet } from '@/lib/historyProjection';
import { measurementShape } from '@/lib/measurement';
import { isWorkingSet, setVolume } from '@/lib/records';
import { sessionTotals } from '@/lib/volume';

/**
 * What a session is worth, per metric — and **which metrics a measurement type
 * is even allowed to offer**.
 *
 * Pure by construction (architecture §7): sessions in, points out. Nothing here
 * reads Dexie and nothing here writes French.
 *
 * The rule the whole module exists for: *never offer the same metric to every
 * kind of exercise*. "Charge max" on an assisted machine congratulates the most
 * assisted session; "tonnage" on a plank is zero forever. A chart that plots the
 * wrong number is worse than no chart, because it is believed.
 */

/** The unit a reading wears. `'sets'` is a count, not a physical unit. */
export type MetricUnit = 'kg' | 'reps' | 'seconds' | 'meters' | 'sets';

export type MetricKey =
  | 'topWeight'
  | 'bestSetVolume'
  | 'sessionTonnage'
  | 'topReps'
  | 'totalReps'
  | 'workingSets'
  | 'lowestAssist'
  | 'topDuration'
  | 'totalDuration'
  | 'topDistance'
  | 'totalDistance';

export interface MetricDefinition {
  key: MetricKey;
  unit: MetricUnit;
  /**
   * Which way progress runs.
   *
   * `'lower'` for assistance, and for nothing else: on an assisted machine, less
   * help is a better set. Without this field a genuine improvement draws a curve
   * that falls, and the screen marks the wrong session as the record — the
   * failure §10.1 of the finishing document calls out by name.
   */
  betterWhen: 'higher' | 'lower';
}

const DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  topWeight: { key: 'topWeight', unit: 'kg', betterWhen: 'higher' },
  bestSetVolume: { key: 'bestSetVolume', unit: 'kg', betterWhen: 'higher' },
  sessionTonnage: { key: 'sessionTonnage', unit: 'kg', betterWhen: 'higher' },
  topReps: { key: 'topReps', unit: 'reps', betterWhen: 'higher' },
  totalReps: { key: 'totalReps', unit: 'reps', betterWhen: 'higher' },
  workingSets: { key: 'workingSets', unit: 'sets', betterWhen: 'higher' },
  lowestAssist: { key: 'lowestAssist', unit: 'kg', betterWhen: 'lower' },
  topDuration: { key: 'topDuration', unit: 'seconds', betterWhen: 'higher' },
  totalDuration: { key: 'totalDuration', unit: 'seconds', betterWhen: 'higher' },
  topDistance: { key: 'topDistance', unit: 'meters', betterWhen: 'higher' },
  totalDistance: { key: 'totalDistance', unit: 'meters', betterWhen: 'higher' },
};

/**
 * The metrics each measurement type may plot, **best one first** — the screen
 * opens on it, so the order is the default answer to "how am I doing on this".
 */
const OFFERED: Record<MeasurementType, MetricKey[]> = {
  weight_reps: ['topWeight', 'bestSetVolume', 'sessionTonnage', 'totalReps', 'workingSets'],
  weight_time: ['topWeight', 'totalDuration', 'topDuration', 'workingSets'],
  // Bodyweight: the belt is progress too, but repetitions are the headline.
  reps_only: ['topReps', 'sessionTonnage', 'totalReps', 'workingSets'],
  assisted_weight_reps: [
    'lowestAssist',
    'sessionTonnage',
    'topReps',
    'totalReps',
    'workingSets',
  ],
  time_only: ['topDuration', 'totalDuration', 'workingSets'],
  distance_time: ['topDistance', 'totalDistance', 'totalDuration', 'workingSets'],
};

export function metricDefinition(key: MetricKey): MetricDefinition {
  return DEFINITIONS[key];
}

/**
 * Empty for an unknown type rather than a default list: a row with no snapshot
 * whose exercise is gone has no measurement type, and guessing one would plot
 * kilograms against a plank.
 */
export function availableMetrics(type: MeasurementType | undefined): MetricDefinition[] {
  if (type === undefined) return [];
  return OFFERED[type].map((key) => DEFINITIONS[key]);
}

/** One session's rows, with the identity **that session** was recorded under. */
export interface AnalyticsSet extends HistoricalSet {
  bodyweightLoadFactor?: number;
}

export interface AnalyticsSession {
  workoutId: string;
  /** `workout.startedAt` — never a set's `performedAt`, cf. spec §2.2. */
  startedAt: number;
  /** From the snapshot, falling back to the library. May be absent. */
  measurementType?: MeasurementType;
  bodyWeightKg?: number;
  sets: AnalyticsSet[];
}

export interface MetricPoint {
  workoutId: string;
  timestamp: number;
  value: number;
}

/** Largest of a mapped figure, `undefined` when nothing carries one. */
function best(
  sets: HistoricalSet[],
  read: (set: HistoricalSet) => number | undefined,
  pick: (a: number, b: number) => number,
): number | undefined {
  let found: number | undefined;

  for (const set of sets) {
    const value = read(set);
    if (value === undefined) continue;
    found = found === undefined ? value : pick(found, value);
  }

  return found;
}

const larger = (a: number, b: number) => Math.max(a, b);
const smaller = (a: number, b: number) => Math.min(a, b);

/**
 * A session's figure for one metric, or `undefined` when it has none.
 *
 * `undefined` and not `0`: a session that carries no value for the metric must
 * produce **no point at all**. A zero would be plotted, and a curve that dives
 * to the floor because an exercise was retyped is a lie the reader cannot see
 * through.
 */
function valueOf(key: MetricKey, session: AnalyticsSession): number | undefined {
  const type = session.measurementType;
  if (type === undefined) return undefined;

  // The guard that makes the module honest: an assisted machine stores its help
  // in the same field a bench press stores its load, so reading `weight` without
  // asking what the weight *means* is how "charge max" ends up charting
  // assistance. `OFFERED` is the only place that answers.
  if (!OFFERED[type].includes(key)) return undefined;

  // RF-20 — warm-ups pollute neither volume nor records, and the rule is
  // `isWorkingSet`'s, restated nowhere.
  const sets = session.sets.filter(isWorkingSet);
  if (sets.length === 0) return undefined;

  const totals = () =>
    sessionTotals(
      sets.map((set) => ({
        set,
        weightRole: measurementShape(type).weightRole,
        bodyweightLoadFactor: set.bodyweightLoadFactor,
      })),
      session.bodyWeightKg,
    );

  switch (key) {
    case 'topWeight':
      return best(sets, (set) => set.weight, larger);
    case 'lowestAssist':
      // Zero included: an unassisted repetition is the best possible reading,
      // and dropping it would hide the very session that got there.
      return best(sets, (set) => set.weight, smaller);
    case 'bestSetVolume':
      return best(sets, (set) => setVolume(set) || undefined, larger);
    case 'sessionTonnage':
      return totals().tonnage || undefined;
    case 'topReps':
      return best(sets, (set) => set.reps, larger);
    case 'totalReps':
      return totals().totalReps || undefined;
    case 'workingSets':
      return sets.length;
    case 'topDuration':
      return best(sets, (set) => set.durationSeconds, larger);
    case 'totalDuration':
      return totals().durationSeconds || undefined;
    case 'topDistance':
      return best(sets, (set) => set.distanceMeters, larger);
    case 'totalDistance':
      return totals().distanceMeters || undefined;
  }
}

/** The curve: one point per session that has a figure, oldest first. */
export function metricSeries(key: MetricKey, sessions: AnalyticsSession[]): MetricPoint[] {
  return sessions.flatMap((session) => {
    const value = valueOf(key, session);
    if (value === undefined) return [];
    return [{ workoutId: session.workoutId, timestamp: session.startedAt, value }];
  });
}

/**
 * The point that holds the record — the **only** one the chart colours.
 *
 * Ties go to the oldest, which is `pickBest`'s rule in `records.ts` read from
 * the same side: a record is established the first time it is reached, not the
 * last. And under `betterWhen: 'lower'` the record is the minimum, which is the
 * entire reason that flag exists.
 */
export function bestPointIndex(
  points: readonly MetricPoint[],
  betterWhen: MetricDefinition['betterWhen'],
): number | undefined {
  let found: number | undefined;

  points.forEach((point, index) => {
    if (found === undefined) {
      found = index;
      return;
    }
    const current = points[found]!.value;
    if (betterWhen === 'higher' ? point.value > current : point.value < current) found = index;
  });

  return found;
}
