import type { SetType } from '@/data/types';
import type { WeightRole } from './measurement';
import { isWorkingSet } from './records';
import { resolveRepSeconds } from './tempo';

/**
 * What a finished session adds up to.
 *
 * Announced in §7 of the architecture and never written until now, because
 * nothing could log a set before Lot 5.
 *
 * Pure by construction (§7): sets in, numbers out. Liveness and completion are
 * the repository's business — this module is only ever handed sets that count.
 */

export interface SessionTotals {
  /** Sets excluding warm-ups. */
  workingSets: number;
  totalReps: number;
  /** Kilograms moved from external loads and effective bodyweight loads. */
  tonnage: number;
  /**
   * Seconds spent working — the stopwatch where the exercise is timed, the
   * repetitions at their own tempo everywhere else. Cf. `workingSecondsOf`.
   */
  workingSeconds: number;
  distanceMeters: number;
}

/**
 * One set and what its kilos mean, which only the exercise's measurement type
 * knows. Absent for a set whose exercise has no weight field at all.
 */
export interface VolumeSet {
  setType: SetType;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
}

export interface VolumeEntry {
  set: VolumeSet;
  weightRole?: WeightRole;
  bodyweightLoadFactor?: number;
  /**
   * Whether the exercise is measured by the clock — `isTimedMeasurement`. The
   * totals read a set through its measurement type exactly as the screen does,
   * so a figure the screen does not show is a figure they do not count.
   */
  timed?: boolean;
  /**
   * Seconds per repetition for this exercise, already resolved against the
   * preference (cf. `lib/tempo`). Absent falls back to `DEFAULT_REP_SECONDS`.
   */
  repSeconds?: number;
}

const EMPTY: SessionTotals = {
  workingSets: 0,
  totalReps: 0,
  tonnage: 0,
  workingSeconds: 0,
  distanceMeters: 0,
};

/**
 * How long one set took to perform.
 *
 * **A repetition is time, and the app was pretending it was not.** Summing the
 * stored `durationSeconds` counted the clock of a plank and nothing at all for
 * thirty-one sets of squats — a session read "4:30 min" of work for an hour and
 * a half under the bar, and no one could tell where the 4:30 came from. Worse,
 * a set whose exercise was re-typed or came in from an import still carried
 * seconds the screen no longer displays, so those minutes were both invisible
 * and counted.
 *
 * So the reading follows the measurement type, like every other reading of a
 * past session:
 * - timed exercise → its stopwatch, the figure the lifter actually recorded;
 * - counted exercise → its repetitions at the tempo chosen for that exercise
 *   (`lib/tempo`, 3 s a rep until told otherwise). An estimate, and said to be
 *   one on screen — but an estimate built on the same number the metronome
 *   beats, not on a model of anything.
 *
 * A set with no measurement type left falls back to its repetitions, then to
 * whatever the clock stored: nothing recorded is thrown away.
 */
export function workingSecondsOf(entry: VolumeEntry): number {
  const { set, timed, repSeconds } = entry;
  if (timed === true) return set.durationSeconds ?? 0;
  if (set.reps !== undefined) return set.reps * resolveRepSeconds(repSeconds);
  return set.durationSeconds ?? 0;
}

export function effectiveLoadKg(entry: VolumeEntry, bodyWeightKg?: number): number {
  const { set, weightRole, bodyweightLoadFactor } = entry;
  if (weightRole === 'load') return set.weight ?? 0;

  const bodyLoad =
    bodyWeightKg !== undefined && bodyweightLoadFactor !== undefined
      ? bodyWeightKg * bodyweightLoadFactor
      : 0;

  if (weightRole === 'added') return bodyLoad + (set.weight ?? 0);
  if (weightRole === 'assist') {
    return bodyLoad === 0 ? 0 : Math.max(bodyLoad - (set.weight ?? 0), 0);
  }
  return 0;
}

/**
 * Tonnage uses each exercise's effective load. A bodyweight coefficient and the
 * user's bodyweight make bodyweight, added-weight, and assisted movements
 * comparable with conventional loaded exercises.
 */
export function sessionTotals(entries: VolumeEntry[], bodyWeightKg?: number): SessionTotals {
  const totals = { ...EMPTY };

  for (const entry of entries) {
    const { set } = entry;
    // RF-20. The rule lives in `isWorkingSet` and is not restated here: whatever
    // counts sets has to agree with whatever scores them.
    if (!isWorkingSet(set)) continue;

    totals.workingSets += 1;
    totals.totalReps += set.reps ?? 0;
    totals.workingSeconds += workingSecondsOf(entry);
    totals.distanceMeters += set.distanceMeters ?? 0;
    totals.tonnage += effectiveLoadKg(entry, bodyWeightKg) * (set.reps ?? 0);
  }

  // Floating point: 102,5 × 3 lands on 307.50000000000006 without this, and a
  // session total is read, not computed against.
  totals.tonnage = Math.round(totals.tonnage * 100) / 100;
  // A quarter-second tempo across a session lands on halves of a second, and a
  // total time is read on a gym clock, not on a stopwatch.
  totals.workingSeconds = Math.round(totals.workingSeconds);

  return totals;
}
