import type { SetType } from '@/data/types';
import type { WeightRole } from './measurement';
import { isWorkingSet } from './records';

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
}

const EMPTY: SessionTotals = {
  workingSets: 0,
  totalReps: 0,
  tonnage: 0,
  durationSeconds: 0,
  distanceMeters: 0,
};

function effectiveLoadKg(entry: VolumeEntry, bodyWeightKg?: number): number {
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
    totals.durationSeconds += set.durationSeconds ?? 0;
    totals.distanceMeters += set.distanceMeters ?? 0;
    totals.tonnage += effectiveLoadKg(entry, bodyWeightKg) * (set.reps ?? 0);
  }

  // Floating point: 102,5 × 3 lands on 307.50000000000006 without this, and a
  // session total is read, not computed against.
  totals.tonnage = Math.round(totals.tonnage * 100) / 100;

  return totals;
}
