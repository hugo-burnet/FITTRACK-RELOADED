import type { MuscleGroup, WorkoutSet } from '@/data/types';
import { isWorkingSet } from '@/lib/records';

/**
 * One line of a session, reduced to what the drawing needs.
 *
 * Structural rather than the repository's `WorkoutExerciseDetail`: `lib/` is
 * pure by construction (architecture §7) and must not import a repository. The
 * screens resolve the muscles themselves, through `workoutExerciseIdentityOf` —
 * the one rule the whole app reads a past session through, restated nowhere.
 */
export interface InvolvedExerciseLike {
  /**
   * Optional **and** explicitly `undefined`-able: a live line always has the key
   * and may have no answer, a projected row omits it entirely. Both are the same
   * fact — the exercise was deleted and left no snapshot.
   */
  primaryMuscle?: MuscleGroup | undefined;
  secondaryMuscles?: MuscleGroup[];
  /**
   * `isCompleted` is optional because the two callers disagree about who filters.
   * A live session hands over every row, recorded or not, and the filtering has
   * to happen here. The historical projection has already dropped everything
   * unrecorded before the set ever gets a shape — so an absent flag means "this
   * set exists in history", which is only ever true of a recorded one.
   */
  sets: readonly (Pick<WorkoutSet, 'setType'> & { isCompleted?: 0 | 1 })[];
}

/** What one working set is worth to a muscle it involves without targeting. */
export const SECONDARY_SHARE = 0.4;

/**
 * How much each muscle was involved in a session — **not a count**.
 *
 * The field is `value` and never `sets`, because it is not a number of series:
 * a set is worth 1 to the muscle it targets and 0,4 to each muscle it merely
 * involves. The two figures are the ones the exercise sheet already shows, so
 * the app has one vocabulary for involvement rather than two.
 *
 * **Why a score is allowed here when `muscleBalance` refuses one.** That module
 * counts, and it argues — rightly — that a weighted attribution would stop being
 * checkable: "48" must remain a number of sets someone can recount in the
 * history. A drawing has no such duty. It is not read off, it is looked at, and
 * a bench press that leaves the triceps dark is simply false to what happened.
 * So the numbers on the screens stay counts, and only the silhouette is weighted.
 *
 * Two filters, both specific to a single session:
 *
 * - **`isCompleted`**, because a live session carries the sets still to come.
 *   Counting them would light a muscle for work not yet done, and the recap is
 *   read while the last set is still on the grid.
 * - **`isWorkingSet`** — RF-20, warm-ups pollute neither volume nor records, and
 *   the rule is `records.ts`'s, not restated.
 *
 * Muscles are not pre-filled with zeros, unlike `muscleBalance`: a session is not
 * a distribution, and "0 series of calves today" is not a shortfall to report —
 * it is simply not what today was.
 */
export interface MuscleInvolvement {
  muscle: MuscleGroup | undefined;
  value: number;
}

export function muscleInvolvement(lines: readonly InvolvedExerciseLike[]): MuscleInvolvement[] {
  const involvement = new Map<MuscleGroup | undefined, number>();
  const add = (muscle: MuscleGroup | undefined, value: number) => {
    involvement.set(muscle, (involvement.get(muscle) ?? 0) + value);
  };

  for (const line of lines) {
    const sets = line.sets.filter((set) => set.isCompleted !== 0 && isWorkingSet(set)).length;
    if (sets === 0) continue;

    // Added rather than assigned: the same exercise picked up twice in one
    // session is two lines, and both lots of work count.
    add(line.primaryMuscle, sets);

    for (const secondary of line.secondaryMuscles ?? []) {
      // A muscle listed as both is already fully credited; adding its share on
      // top would push it past every other muscle for no reason.
      if (secondary === line.primaryMuscle) continue;
      add(secondary, sets * SECONDARY_SHARE);
    }
  }

  return [...involvement].map(([muscle, value]) => ({ muscle, value }));
}
