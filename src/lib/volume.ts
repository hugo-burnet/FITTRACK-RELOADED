import type { WorkoutSet } from '@/data/types';
import type { WeightRole } from './measurement';
import { isWorkingSet, setVolume } from './records';

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
  /** Kilograms, counted **only** where the weight really is the load. */
  tonnage: number;
  durationSeconds: number;
  distanceMeters: number;
}

/**
 * One set and what its kilos mean, which only the exercise's measurement type
 * knows. Absent for a set whose exercise has no weight field at all.
 */
export interface VolumeEntry {
  set: WorkoutSet;
  weightRole?: WeightRole;
}

const EMPTY: SessionTotals = {
  workingSets: 0,
  totalReps: 0,
  tonnage: 0,
  durationSeconds: 0,
  distanceMeters: 0,
};

/**
 * Tonnage counts a set only when its weight **is** the load.
 *
 * A 10 kg belt on a pull-up and a 20 kg assistance on a machine are both stored
 * in the same field as a 100 kg bench press, and adding the three together
 * produces a number that is simply false: the app does not know the user's
 * bodyweight, and an assistance is weight taken *off*. A bodyweight session
 * therefore shows a tonnage of zero — which is why the finish screen shows three
 * figures (sets · reps · tonnage) and not that one alone.
 */
export function sessionTotals(entries: VolumeEntry[]): SessionTotals {
  const totals = { ...EMPTY };

  for (const { set, weightRole } of entries) {
    // RF-20. The rule lives in `isWorkingSet` and is not restated here: whatever
    // counts sets has to agree with whatever scores them.
    if (!isWorkingSet(set)) continue;

    totals.workingSets += 1;
    totals.totalReps += set.reps ?? 0;
    totals.durationSeconds += set.durationSeconds ?? 0;
    totals.distanceMeters += set.distanceMeters ?? 0;
    if (weightRole === 'load') totals.tonnage += setVolume(set);
  }

  // Floating point: 102,5 × 3 lands on 307.50000000000006 without this, and a
  // session total is read, not computed against.
  totals.tonnage = Math.round(totals.tonnage * 100) / 100;

  return totals;
}
