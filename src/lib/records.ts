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

/**
 * The three records of an exercise — the keys of `BestSets`, so a record can
 * never be named here without a way to compute it there.
 */
export type RecordKind = keyof BestSets;

export interface BeatenRecord {
  kind: RecordKind;
  /**
   * The set that held it until now. There is always one: with nothing to beat,
   * nothing was beaten.
   */
  beaten: WorkoutSet;
}

/**
 * RF-23 — what the set just ticked has beaten, most significant first.
 *
 * `others` is every set that counts for the same exercise, **today's already
 * validated ones included**: a record broken on set 2 is a record, and the only
 * thing that makes set 2 different from last month's set is its date. The
 * candidate may be in there — the caller hands over the whole exercise and this
 * filters it out, which is what makes the call impossible to get wrong.
 *
 * Two rules are worth their line:
 *
 * - **A record needs an incumbent.** The first set of an exercise you have never
 *   done beats nothing; it *becomes* the mark. Congratulating it would fire on
 *   the first working set of every new exercise, and could not name what was
 *   beaten. Ties do not count either, which is `pickBest`'s rule read from the
 *   other side: a record is established the first time you reach it.
 * - **Repetitions are only a record where there is no load to beat.** On a bench
 *   press the rep maximum is a light set, and calling it a record is a lie — the
 *   rule the exercise sheet already applies to its display, moved here where it
 *   belongs.
 *
 * Nothing is stored. Asking the question again on every render is what makes an
 * un-tick, a deletion or a mid-session requalification to warm-up (Lot 6, task
 * 1) invalidate a record for free, with no cascade to keep in sync — cf. the
 * note on `personalRecords` in PROGRESS.md.
 */
export function recordsBeatenBy(candidate: WorkoutSet, others: WorkoutSet[]): BeatenRecord[] {
  if (!isWorkingSet(candidate)) return [];

  const best = bestSets(others.filter((set) => set.id !== candidate.id));
  const beaten: BeatenRecord[] = [];

  const load = candidate.weight;
  const hasLoad = load !== undefined && load > 0;

  // Load first: it is the headline when a set takes two records at once.
  if (hasLoad && best.heaviest !== undefined && load > best.heaviest.weight!) {
    beaten.push({ kind: 'heaviest', beaten: best.heaviest });
  }

  const volume = setVolume(candidate);
  if (volume > 0 && best.bestVolume !== undefined && volume > setVolume(best.bestVolume)) {
    beaten.push({ kind: 'bestVolume', beaten: best.bestVolume });
  }

  const reps = candidate.reps;
  if (
    !hasLoad &&
    best.heaviest === undefined &&
    reps !== undefined &&
    best.mostReps !== undefined &&
    reps > best.mostReps.reps!
  ) {
    beaten.push({ kind: 'mostReps', beaten: best.mostReps });
  }

  return beaten;
}
