import { db } from '@/data/db';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import {
  resolveWorkoutExerciseIdentity,
  type WorkoutExerciseIdentity,
} from '@/lib/exerciseSnapshot';
import { alive } from './base';
import { getLastPerformance } from './workoutHistory';

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

export interface WorkoutExerciseDetail {
  row: WorkoutExercise;
  /** `undefined` when the exercise was deleted from the library after being added. */
  exercise: Exercise | undefined;
  /** Snapshot, then library (including soft-deleted rows), then the explicit grid fallback. */
  identity?: WorkoutExerciseIdentity;
  sets: WorkoutSet[];
  /** RF-19 — the same exercise, last time. Never this session. */
  previous: WorkoutSet[];
}

export interface WorkoutDetail {
  workout: Workout;
  exercises: WorkoutExerciseDetail[];
}

/**
 * Reads the repository-resolved identity, with a compatibility path for
 * in-memory details assembled by tests and pure consumers.
 */
export function workoutExerciseIdentityOf(
  line: Pick<WorkoutExerciseDetail, 'row' | 'exercise' | 'identity'>,
): WorkoutExerciseIdentity {
  return line.identity ?? resolveWorkoutExerciseIdentity(line.row, line.exercise);
}

/**
 * Everything the live screen draws, in one read.
 *
 * Returns `null` and never `undefined` for a session that is gone: `useLiveQuery`
 * uses `undefined` for "has not answered yet", and blurring the two makes a
 * freshly opened screen flash its empty state.
 */
export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail | null> {
  const workout = await db.workouts.get(workoutId);
  if (workout === undefined || workout.deletedAt !== 0) return null;

  const rows = alive(await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort(
    byOrder,
  );

  const [sets, found] = await Promise.all([
    db.workoutSets
      .where('workoutExerciseId')
      .anyOf(rows.map((row) => row.id))
      .toArray(),
    db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]),
  ]);

  const library = new Map<string, Exercise>();
  const activeLibrary = new Map<string, Exercise>();
  for (const exercise of found) {
    if (exercise === undefined) continue;
    library.set(exercise.id, exercise);
    if (exercise.deletedAt === 0) activeLibrary.set(exercise.id, exercise);
  }

  const setsPerRow = new Map<string, WorkoutSet[]>();
  for (const set of alive(sets)) {
    const list = setsPerRow.get(set.workoutExerciseId);
    if (list === undefined) setsPerRow.set(set.workoutExerciseId, [set]);
    else list.push(set);
  }

  // One lookup per distinct exercise, not per row: the same movement done twice
  // in a session has one and the same "last time".
  const history = new Map<string, WorkoutSet[]>();
  await Promise.all(
    [...new Set(rows.map((row) => row.exerciseId))].map(async (exerciseId) => {
      history.set(exerciseId, await getLastPerformance(exerciseId, workoutId));
    }),
  );

  return {
    workout,
    exercises: rows.map((row) => ({
      row,
      exercise: activeLibrary.get(row.exerciseId),
      identity: resolveWorkoutExerciseIdentity(row, library.get(row.exerciseId)),
      sets: (setsPerRow.get(row.id) ?? []).sort(byOrder),
      previous: history.get(row.exerciseId) ?? [],
    })),
  };
}
