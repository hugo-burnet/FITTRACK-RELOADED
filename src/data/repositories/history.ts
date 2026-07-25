import { db } from '@/data/db';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';

export interface HistoryFilters {
  exerciseId?: string;
}

export interface HistoryWorkoutSummary {
  workoutId: string;
  name: string;
  startedAt: number;
  durationSeconds: number;
  exerciseCount: number;
  completedSetCount: number;
}

export interface HistoryPage {
  items: HistoryWorkoutSummary[];
  hasMore: boolean;
}

const byMostRecent = (left: Workout, right: Workout): number =>
  right.startedAt - left.startedAt || right.id.localeCompare(left.id);

async function listFilteredCompletedWorkouts(filters: HistoryFilters): Promise<Workout[]> {
  const completed = (
    await db.workouts.where('status').equals('completed').toArray()
  ).filter((workout) => workout.deletedAt === 0);

  if (filters.exerciseId === undefined) return completed.sort(byMostRecent);

  const matchingRows = await db.workoutExercises
    .where('exerciseId')
    .equals(filters.exerciseId)
    .filter((row) => row.deletedAt === 0)
    .toArray();
  const matchingWorkoutIds = new Set(matchingRows.map((row) => row.workoutId));

  return completed
    .filter((workout) => matchingWorkoutIds.has(workout.id))
    .sort(byMostRecent);
}

async function buildSummaries(workouts: readonly Workout[]): Promise<HistoryWorkoutSummary[]> {
  if (workouts.length === 0) return [];

  const workoutIds = workouts.map((workout) => workout.id);
  const [rows, sets] = await Promise.all([
    db.workoutExercises.where('workoutId').anyOf(workoutIds).toArray(),
    db.workoutSets.where('workoutId').anyOf(workoutIds).toArray(),
  ]);

  const exerciseCount = countByWorkout(
    rows.filter((row) => row.deletedAt === 0),
  );
  const completedSetCount = countByWorkout(
    sets.filter((set) => set.deletedAt === 0 && set.isCompleted === 1),
  );

  return workouts.map((workout) => ({
    workoutId: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
    durationSeconds: workout.durationSeconds,
    exerciseCount: exerciseCount.get(workout.id) ?? 0,
    completedSetCount: completedSetCount.get(workout.id) ?? 0,
  }));
}

function countByWorkout(
  rows: readonly (WorkoutExercise | WorkoutSet)[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.workoutId, (counts.get(row.workoutId) ?? 0) + 1);
  return counts;
}

export async function listCompletedWorkoutTimestamps(
  filters: HistoryFilters = {},
): Promise<number[]> {
  return (await listFilteredCompletedWorkouts(filters)).map((workout) => workout.startedAt);
}

export async function listHistoryPage(
  filters: HistoryFilters,
  offset: number,
  limit = 20,
): Promise<HistoryPage> {
  const completed = await listFilteredCompletedWorkouts(filters);
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.max(1, Math.trunc(limit));
  const window = completed.slice(safeOffset, safeOffset + safeLimit + 1);

  return {
    items: await buildSummaries(window.slice(0, safeLimit)),
    hasMore: window.length > safeLimit,
  };
}

export async function listHistoryDay(
  filters: HistoryFilters,
  localDay: number,
): Promise<HistoryWorkoutSummary[]> {
  const start = new Date(localDay);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const workouts = (await listFilteredCompletedWorkouts(filters)).filter(
    (workout) => workout.startedAt >= start.getTime() && workout.startedAt < end.getTime(),
  );
  return buildSummaries(workouts);
}

export async function listHistoryExerciseOptions(): Promise<
  Array<Pick<Exercise, 'id' | 'name'>>
> {
  const completedIds = new Set(
    (await listFilteredCompletedWorkouts({})).map((workout) => workout.id),
  );
  if (completedIds.size === 0) return [];

  const rows = (await db.workoutExercises.toArray()).filter(
    (row) => row.deletedAt === 0 && completedIds.has(row.workoutId),
  );
  const exercises = await db.exercises.bulkGet([
    ...new Set(rows.map((row) => row.exerciseId)),
  ]);

  return exercises
    .filter(
      (exercise): exercise is Exercise =>
        exercise !== undefined && exercise.deletedAt === 0,
    )
    .map(({ id, name }) => ({ id, name }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }),
    );
}
