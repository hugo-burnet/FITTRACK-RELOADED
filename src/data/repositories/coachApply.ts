import { db } from '@/data/db';
import type { WorkoutSet } from '@/data/types';
import { resolveWorkoutExerciseIdentity } from '@/lib/exerciseSnapshot';
import { measurementShape } from '@/lib/measurement';
import { alive, touch } from './base';

/**
 * Write a coach objective onto the sets still to be done — on an explicit tap.
 *
 * The plan forbids the coach from pre-filling a set on its own, and that stands:
 * a figure that appears by itself is a figure you stop reading. This is the user
 * saying it, once, with a thumb. Nothing is locked afterwards — every field
 * stays editable, and a set already validated is never touched.
 *
 * Mirrors `applyWorkoutDeload`, deliberately: a set with nothing typed yet gets
 * a *target*, so the grid still shows an empty field to fill in; a set that
 * already carries a value gets the value replaced.
 *
 * Returns how many sets changed, so the caller can stay silent on a no-op.
 */
export async function applyCoachObjective(
  workoutExerciseId: string,
  loadKg: number,
): Promise<number> {
  if (!Number.isFinite(loadKg) || loadKg < 0) return 0;

  return db.transaction(
    'rw',
    db.workoutSets,
    db.workoutExercises,
    db.exercises,
    async () => {
      const row = await db.workoutExercises.get(workoutExerciseId);
      if (row === undefined || row.deletedAt !== 0) return 0;

      const exercise = await db.exercises.get(row.exerciseId);
      const { measurementType } = resolveWorkoutExerciseIdentity(row, exercise);
      // Any weight field will do — assistance has one too, and it is precisely
      // the case where the number goes down as you get stronger.
      if (measurementShape(measurementType ?? 'weight_reps').weightRole === undefined) {
        return 0;
      }

      const pending = alive(
        await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).toArray(),
      ).filter((set) => set.isCompleted === 0);

      const changed: WorkoutSet[] = pending.map((set) =>
        set.weight === undefined
          ? touch(set, { targetWeight: loadKg })
          : touch(set, { weight: loadKg }),
      );

      if (changed.length === 0) return 0;
      await db.workoutSets.bulkPut(changed);
      return changed.length;
    },
  );
}
