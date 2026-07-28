import { db } from '@/data/db';
import type { Exercise, WorkoutExercise } from '@/data/types';
import { snapshotOf } from '@/lib/exerciseSnapshot';
import { touch } from './base';

/**
 * Replays the exercise snapshot of the whole history from today's library.
 *
 * **This deliberately repaints the past, which is the one thing milestone 08A
 * exists to prevent** — so it is never automatic and never silent. The snapshot
 * is right whenever the library was right when the session was recorded; it is
 * wrong when the library itself was wrong, and no amount of freezing fixes a
 * value that was already false. That was the case here: hip adduction was filed
 * under `glutes`, external rotation had no catalogue entry at all, and the
 * version 2 migration froze both onto every row it touched.
 *
 * The caller confirms first. The button says what it does, in French, and the
 * cost is real: a session whose exercise was legitimately renamed *after* it was
 * performed will take the new name.
 */
export interface HistoryRepairResult {
  /** Rows whose snapshot actually changed. */
  repaired: number;
  /** Rows left exactly as they were, for either reason below. */
  kept: number;
}

/** Whether today's library says something different from what the row carries. */
function differs(row: WorkoutExercise, exercise: Exercise): boolean {
  return (
    row.exerciseName !== exercise.name ||
    row.exerciseMeasurementType !== exercise.measurementType ||
    row.exercisePrimaryMuscle !== exercise.primaryMuscle ||
    row.exerciseEquipment !== exercise.equipment
  );
}

export async function resnapshotHistory(): Promise<HistoryRepairResult> {
  return db.transaction('rw', db.exercises, db.workoutExercises, async () => {
    // Soft-deleted exercises included: `deleteExercise` never really removes
    // one, and a deleted exercise is still the exercise that was performed.
    const exercises = await db.exercises.toArray();
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

    let repaired = 0;
    let kept = 0;

    await db.workoutExercises.toCollection().modify((row) => {
      const exercise = byId.get(row.exerciseId);
      // The guard that keeps this a repair rather than a loss: `snapshotOf`
      // returns `{}` for an unknown exercise, and writing that would erase the
      // only surviving record of what the row was.
      if (exercise === undefined || !differs(row, exercise)) {
        kept += 1;
        return;
      }

      Object.assign(row, touch(row, snapshotOf(exercise)));
      repaired += 1;
    });

    return { repaired, kept };
  });
}
