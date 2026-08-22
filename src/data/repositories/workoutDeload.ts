import { db } from '@/data/db';
import type { Workout, WorkoutSet } from '@/data/types';
import {
  calculateDeloadWeight,
  DELOAD_PERCENT,
  isDeloadEligibleMeasurement,
} from '@/lib/deload';
import { resolveWorkoutExerciseIdentity } from '@/lib/exerciseSnapshot';
import { alive, touch } from './base';
import { getLastPerformance } from './workoutHistory';

const byOrder = (left: WorkoutSet, right: WorkoutSet): number => left.order - right.order;

/**
 * Adds the deload's line to the session's notes, once.
 *
 * Trimmed to *decide*, raw to *join*, and that asymmetry is deliberate. What is
 * being asked — is there anything here, and does it already say this? — is a
 * question about the text, and neither answer should turn on a trailing
 * newline. What is being written is somebody's own note, and appending a line
 * to it is no licence to reformat what they typed above.
 */
function appendNote(notes: string | undefined, note: string): string | undefined {
  const existing = notes?.trim() ?? '';
  const addition = note.trim();
  if (addition === '' || existing.includes(addition)) return notes;
  return existing === '' ? addition : `${notes}\n\n${addition}`;
}

export async function applyWorkoutDeload(
  workoutId: string,
  note: string,
): Promise<Workout | null> {
  return db.transaction(
    'rw',
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    db.exercises,
    async () => {
      const workout = await db.workouts.get(workoutId);
      if (
        workout === undefined ||
        workout.deletedAt !== 0 ||
        workout.status !== 'active' ||
        workout.deloadPercent !== undefined
      ) {
        return null;
      }

      const rows = alive(
        await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
      );
      const found = await db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]);
      const library = new Map(
        found.flatMap((exercise) =>
          exercise === undefined ? [] : ([[exercise.id, exercise]] as const),
        ),
      );
      const eligibleRows = new Set(
        rows.flatMap((row) => {
          const type = resolveWorkoutExerciseIdentity(
            row,
            library.get(row.exerciseId),
          ).measurementType;
          return isDeloadEligibleMeasurement(type) ? [row.id] : [];
        }),
      );
      const live = alive(
        await db.workoutSets.where('workoutId').equals(workoutId).toArray(),
      ).filter((set) => eligibleRows.has(set.workoutExerciseId));
      const blocks = new Map<string, WorkoutSet[]>();
      for (const set of live) {
        const block = blocks.get(set.workoutExerciseId);
        if (block === undefined) blocks.set(set.workoutExerciseId, [set]);
        else block.push(set);
      }

      const exerciseIds = [...new Set(live.map((set) => set.exerciseId))];
      const previous = new Map(
        await Promise.all(
          exerciseIds.map(async (exerciseId) => [
            exerciseId,
            await getLastPerformance(exerciseId, workoutId),
          ] as const),
        ),
      );

      const changed: WorkoutSet[] = [];
      for (const sets of blocks.values()) {
        sets.sort(byOrder);
        sets.forEach((set, index) => {
          if (set.isCompleted === 1) return;
          const source =
            set.weight ?? set.targetWeight ?? previous.get(set.exerciseId)?.[index]?.weight;
          if (source === undefined) return;
          const reduced = calculateDeloadWeight(source);
          changed.push(
            set.weight === undefined
              ? touch(set, { targetWeight: reduced })
              : touch(set, { weight: reduced }),
          );
        });
      }

      if (changed.length === 0) return null;

      await db.workoutSets.bulkPut(changed);
      const updated = touch(workout, {
        deloadPercent: DELOAD_PERCENT,
        notes: appendNote(workout.notes, note),
      });
      await db.workouts.put(updated);
      return updated;
    },
  );
}
