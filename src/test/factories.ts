import { db } from '@/data/db';
import { DEFAULT_REST_SECONDS } from '@/lib/rest';
import { newEntity } from '@/data/repositories/base';
import type { Workout, WorkoutExercise, WorkoutSet } from '@/data/types';

/**
 * Test data builders. Without them every workout test would re-write thirty
 * lines of setup and become unreadable — and every later lot would re-invent
 * them differently.
 */

/** Day N against a fixed base, so tests never depend on the wall clock. */
const BASE = Date.UTC(2026, 0, 1);
export const day = (n: number): number => BASE + n * 86_400_000;

/** A complete finished session: workout + workoutExercise + validated sets. */
export async function seedWorkout(input: {
  exerciseId: string;
  performedAt: number;
  /** [weight, reps] per set */
  sets: [number, number][];
}): Promise<Workout> {
  const workout = newEntity<Workout>({
    routineId: '',
    name: 'Séance de test',
    status: 'completed',
    startedAt: input.performedAt,
    endedAt: input.performedAt + 3_600_000,
    durationSeconds: 3600,
  });

  const workoutExercise = newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: input.exerciseId,
    order: 0,
    supersetGroup: 0,
    restSeconds: DEFAULT_REST_SECONDS,
  });

  const sets = input.sets.map(([weight, reps], index) =>
    newEntity<WorkoutSet>({
      workoutExerciseId: workoutExercise.id,
      exerciseId: input.exerciseId,
      workoutId: workout.id,
      order: index,
      setType: 'normal',
      side: 'both',
      weight,
      reps,
      isCompleted: 1,
      performedAt: input.performedAt,
    }),
  );

  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await db.workouts.add(workout);
    await db.workoutExercises.add(workoutExercise);
    await db.workoutSets.bulkAdd(sets);
  });

  return workout;
}
