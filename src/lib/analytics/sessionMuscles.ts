import type { MuscleGroup, WorkoutSet } from '@/data/types';
import { isWorkingSet } from '@/lib/records';
import type { MuscleCount } from './muscles';

/**
 * One line of a session, reduced to what a count per muscle needs.
 *
 * Structural rather than the repository's `WorkoutExerciseDetail`: `lib/` is
 * pure by construction (architecture §7) and must not import a repository. The
 * two screens that call this resolve the muscle themselves, through
 * `workoutExerciseIdentityOf` — the one rule every screen reads a past session
 * through, restated nowhere.
 */
export interface SessionExerciseLike {
  primaryMuscle: MuscleGroup | undefined;
  sets: readonly Pick<WorkoutSet, 'setType' | 'isCompleted'>[];
}

/**
 * Working sets per muscle **for a single session**.
 *
 * Two filters, and both matter here in a way they do not on the history screens:
 *
 * - **`isCompleted`**, because a live session carries the sets still to come.
 *   Counting them would light a muscle for work not yet done, and the recap
 *   screen is read while the last set is still on the grid.
 * - **`isWorkingSet`** — RF-20, warm-ups pollute neither volume nor records, and
 *   the rule is `records.ts`'s, not restated.
 *
 * Muscles are not pre-filled with zeros, unlike `muscleBalance`: a session is not
 * a distribution and "0 series of calves today" is not a shortfall to report, it
 * is simply not what today was. The drawing shows what was trained.
 */
export function sessionMuscleCounts(lines: readonly SessionExerciseLike[]): MuscleCount[] {
  const counts = new Map<MuscleGroup | undefined, number>();

  for (const line of lines) {
    const sets = line.sets.filter((set) => set.isCompleted === 1 && isWorkingSet(set)).length;
    if (sets === 0) continue;
    // Added rather than assigned: the same exercise picked up twice in one
    // session is two lines, and the unit here is the set.
    counts.set(line.primaryMuscle, (counts.get(line.primaryMuscle) ?? 0) + sets);
  }

  return [...counts].map(([muscle, sets]) => ({ muscle, sets }));
}
