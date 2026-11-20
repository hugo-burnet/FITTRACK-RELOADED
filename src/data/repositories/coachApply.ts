import { db } from '@/data/db';
import type { WorkoutSet } from '@/data/types';
import { resolveWorkoutExerciseIdentity } from '@/lib/exerciseSnapshot';
import { measurementShape } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';
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
 * Only working sets are written: a warm-up ramp or a drop-set carries its own
 * load, and stamping the objective on it would put 52.5 kg on a 20 kg warm-up.
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
    () => writeObjectiveOnRow(workoutExerciseId, loadKg),
  );
}

/**
 * Apply a pending recommendation to every live line of the workout that holds
 * its exercise, and mark it followed — only if a set was actually written.
 *
 * Why one transaction: the two writes used to be separate, so a tap that wrote
 * nothing (every work set already validated, only warm-ups left) still closed
 * the card as « followed » and the coach believed advice had been taken.
 *
 * Returns how many sets were written; 0 leaves the recommendation `pending`.
 */
export async function applyCoachRecommendation(
  recommendationId: string,
  workoutId: string,
): Promise<number> {
  return db.transaction(
    'rw',
    db.workoutSets,
    db.workoutExercises,
    db.exercises,
    db.coachRecommendations,
    async () => {
      const rec = await db.coachRecommendations.get(recommendationId);
      if (rec === undefined || rec.deletedAt !== 0 || rec.status !== 'pending') return 0;
      const loadKg = rec.nextLoadKg;
      if (loadKg === undefined || !Number.isFinite(loadKg) || loadKg < 0) return 0;

      const rows = alive(await db.workoutExercises.where('workoutId').equals(workoutId).toArray())
        .filter((row) => row.exerciseId === rec.exerciseId);

      let written = 0;
      for (const row of rows) written += await writeObjectiveOnRow(row.id, loadKg);
      if (written === 0) return 0;

      await db.coachRecommendations.put(
        touch(rec, {
          status: 'followed',
          resolvedAt: Date.now(),
          outcomeWorkoutId: workoutId,
          outcomeLoadKg: loadKg,
        }),
      );
      return written;
    },
  );
}

/** Shared core; must run inside a transaction covering sets, rows and exercises. */
async function writeObjectiveOnRow(workoutExerciseId: string, loadKg: number): Promise<number> {
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
  ).filter((set) => set.isCompleted === 0 && isWorkingSet(set) && set.setType !== 'dropset');

  const changed: WorkoutSet[] = pending.map((set) =>
    set.weight === undefined
      ? touch(set, { targetWeight: loadKg })
      : touch(set, { weight: loadKg }),
  );

  if (changed.length === 0) return 0;
  await db.workoutSets.bulkPut(changed);
  return changed.length;
}
