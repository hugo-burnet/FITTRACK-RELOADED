import type { WorkoutSet } from '@/data/types';

/**
 * What counts as a record — defined **once**, for the whole project.
 *
 * Lot 3 derives records from the history it reads, because the
 * `personalRecords` table stays empty until a workout can actually be logged.
 * Lot 6 (live detection) and Lot 13 (full recompute) consume these same
 * functions rather than restating the rules, so the three can never disagree.
 *
 * Pure by construction (architecture §7): sets in, sets out. Liveness and
 * completion are the repository's business — this module is only ever handed
 * sets that already count.
 */

export interface BestSets {
  /** Heaviest load lifted, with its rep context. */
  heaviest?: WorkoutSet;
  /** Most repetitions in a single set — the only record a bodyweight movement has. */
  mostReps?: WorkoutSet;
  /** Best single set by load × reps. Rarely the same set as `heaviest`. */
  bestVolume?: WorkoutSet;
}

/** 0 whenever either half is missing: a plank and a pull-up have no tonnage. */
export function setVolume(set: WorkoutSet): number {
  if (set.weight === undefined || set.reps === undefined) return 0;
  return set.weight * set.reps;
}

/**
 * Best set by `score`, ties going to the **oldest**: a record is established the
 * first time you reach it, not the last.
 *
 * A score of 0 or less never wins, which is what keeps a bodyweight set out of
 * the load records and leaves the field `undefined` instead — the detail screen
 * then simply omits the line, and all six measurement types work without a
 * single `switch`.
 */
function pickBest(
  sets: WorkoutSet[],
  score: (set: WorkoutSet) => number | undefined,
): WorkoutSet | undefined {
  let best: WorkoutSet | undefined;
  let bestScore = 0;

  for (const candidate of sets) {
    const value = score(candidate);
    if (value === undefined || value <= 0) continue;

    if (
      best === undefined ||
      value > bestScore ||
      (value === bestScore && candidate.performedAt < best.performedAt)
    ) {
      best = candidate;
      bestScore = value;
    }
  }

  return best;
}

/**
 * Warm-ups pollute neither volume nor records (RF-20, enforced from Lot 3 on).
 *
 * Exported because anything that *counts* sets has to agree with anything that
 * *scores* them: a history row reading "4 séries · 100 kg × 5" where the 4
 * includes a warm-up and the 100 kg does not is two answers to one question.
 */
export const isWorkingSet = (set: WorkoutSet): boolean => set.setType !== 'warmup';

export function bestSets(sets: WorkoutSet[]): BestSets {
  const scored = sets.filter(isWorkingSet);

  return {
    heaviest: pickBest(scored, (set) => set.weight),
    mostReps: pickBest(scored, (set) => set.reps),
    bestVolume: pickBest(scored, setVolume),
  };
}
