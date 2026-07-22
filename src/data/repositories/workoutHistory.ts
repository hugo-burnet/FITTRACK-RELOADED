import Dexie from 'dexie';
import { db } from '@/data/db';
import type { WorkoutSet } from '@/data/types';

/**
 * What past sessions say — read across sessions, never inside one.
 *
 * Split out of `workouts.ts`, which owns the write path of the session in
 * progress. These two queries have a different audience: the exercise sheet of
 * Lot 3 reads them, the live screen of Lot 5 reads them, and the history screen
 * of Lot 7 will own them. Both walk the same composite index
 * `[exerciseId+performedAt]` from the same lower bound of 1 — an unvalidated set
 * carries `performedAt: 0` and is not history.
 */

/**
 * RF-19 — the critical query. Runs for every exercise when the live workout
 * screen opens, and the user expects it instantly. Hence the composite index
 * and the denormalised `exerciseId`: without them this would be three cascading
 * queries (§5.1).
 *
 * The scan walks backwards and stops on the first live set rather than reading
 * the last one and filtering after: a deleted session must fall back to the one
 * before it, not blank the display.
 *
 * `excludeWorkoutId` is what keeps the column a **reference** rather than a
 * mirror. Without it, ticking today's first set makes "previous" show today's
 * first set — the query has no idea which session is on screen, and the most
 * recent validated set is by definition the one just entered.
 */
export async function getLastPerformance(
  exerciseId: string,
  excludeWorkoutId?: string,
): Promise<WorkoutSet[]> {
  const lastSet = await db.workoutSets
    .where('[exerciseId+performedAt]')
    .between([exerciseId, 1], [exerciseId, Dexie.maxKey])
    .reverse()
    .filter(
      (set) =>
        set.deletedAt === 0 && set.isCompleted === 1 && set.workoutId !== (excludeWorkoutId ?? ''),
    )
    .first();

  if (lastSet === undefined) return [];

  return db.workoutSets
    .where({ workoutExerciseId: lastSet.workoutExerciseId })
    .filter((set) => set.deletedAt === 0 && set.isCompleted === 1)
    .sortBy('order');
}

/**
 * One block of a given exercise inside one session — the same unit
 * `getLastPerformance` returns, which is why they are grouped by
 * `workoutExerciseId` and not by `workoutId`: an exercise done twice in one
 * session is two blocks, and merging them would collide their `order`s.
 */
export interface ExerciseSession {
  workoutId: string;
  workoutExerciseId: string;
  /** Date of the first validated set of the block. */
  performedAt: number;
  sets: WorkoutSet[];
}

/** RF-10 — the whole history of one exercise, most recent first. */
export async function listSessionsForExercise(exerciseId: string): Promise<ExerciseSession[]> {
  const sets = await db.workoutSets
    .where('[exerciseId+performedAt]')
    .between([exerciseId, 1], [exerciseId, Dexie.maxKey])
    .filter((set) => set.deletedAt === 0 && set.isCompleted === 1)
    .toArray();

  const blocks = new Map<string, ExerciseSession>();

  for (const set of sets) {
    const block = blocks.get(set.workoutExerciseId);
    if (block === undefined) {
      blocks.set(set.workoutExerciseId, {
        workoutId: set.workoutId,
        workoutExerciseId: set.workoutExerciseId,
        performedAt: set.performedAt,
        sets: [set],
      });
      continue;
    }
    block.sets.push(set);
    // Not merely the first set seen: the index order survives the filter today,
    // but a block's date should not depend on that staying true.
    block.performedAt = Math.min(block.performedAt, set.performedAt);
  }

  for (const block of blocks.values()) block.sets.sort((a, b) => a.order - b.order);

  return [...blocks.values()].sort((a, b) => b.performedAt - a.performedAt);
}
