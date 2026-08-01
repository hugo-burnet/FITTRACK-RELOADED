import { db } from '@/data/db';
import type { Workout, WorkoutSet } from '@/data/types';
import { calculateDeloadWeight, DELOAD_PERCENT } from '@/lib/deload';
import { measurementShape } from '@/lib/measurement';
import { alive, touch } from './base';
import { getLastPerformance } from './workoutHistory';

const byOrder = (left: WorkoutSet, right: WorkoutSet): number => left.order - right.order;

function appendNote(notes: string | undefined, note: string): string | undefined {
  const current = notes?.trim();
  const addition = note.trim();
  if (addition === '') return current;
  if (current?.includes(addition)) return current;
  return current === undefined || current === '' ? addition : `${current}\n\n${addition}`;
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
        found
          .filter((exercise) => exercise !== undefined)
          .map((exercise) => [exercise.id, exercise]),
      );
      const eligibleRows = new Set(
        rows.flatMap((row) => {
          const type = library.get(row.exerciseId)?.measurementType ?? 'weight_reps';
          const role = measurementShape(type).weightRole;
          return role !== undefined && role !== 'assist' ? [row.id] : [];
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
