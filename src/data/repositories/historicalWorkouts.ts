import { db } from '@/data/db';
import type {
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import type {
  HistoricalExercise,
  HistoricalScope,
  HistoricalSet,
  HistoricalWorkout,
} from '@/lib/historyProjection';
import { resolveRepSeconds } from '@/lib/tempo';
import { alive } from './base';
import { resolveBodyWeightsAt } from './bodyMeasurements';
import { getDefaultRepSeconds } from './settings';

const byOrder = <T extends { order: number }>(
  left: T,
  right: T,
): number => left.order - right.order;

const byOldestFirst = (left: Workout, right: Workout): number =>
  left.startedAt - right.startedAt || left.id.localeCompare(right.id);

const isArchived = (
  workout: Workout | undefined,
): workout is Workout =>
  workout !== undefined &&
  workout.deletedAt === 0 &&
  workout.status === 'completed';

const withinBounds = (
  at: number,
  from?: number,
  to?: number,
): boolean =>
  (from === undefined || at >= from) &&
  (to === undefined || at < to);

async function selectWorkouts(
  scope: HistoricalScope,
): Promise<Workout[]> {
  if (scope.kind === 'workout') {
    const workout = await db.workouts.get(scope.workoutId);
    return isArchived(workout) ? [workout] : [];
  }

  if (scope.kind === 'period') {
    const found = await db.workouts
      .where('startedAt')
      .between(scope.from, scope.to, true, false)
      .toArray();
    return found.filter(isArchived).sort(byOldestFirst);
  }

  if (scope.kind === 'exercise') {
    const rows = alive(
      await db.workoutExercises
        .where('exerciseId')
        .equals(scope.exerciseId)
        .toArray(),
    );
    const found = await db.workouts.bulkGet([
      ...new Set(rows.map((row) => row.workoutId)),
    ]);

    return found
      .filter(isArchived)
      .filter((workout) =>
        withinBounds(workout.startedAt, scope.from, scope.to),
      )
      .sort(byOldestFirst);
  }

  const found = await db.workouts
    .where('status')
    .equals('completed')
    .toArray();
  return found.filter(isArchived).sort(byOldestFirst);
}

async function loadWorkoutGraph(
  workoutIds: readonly string[],
): Promise<{
  rows: WorkoutExercise[];
  sets: WorkoutSet[];
}> {
  if (workoutIds.length === 0) return { rows: [], sets: [] };

  return db.transaction(
    'r',
    db.workoutExercises,
    db.workoutSets,
    async () => {
      const [rowsByWorkout, setsByWorkout] = await Promise.all([
        Promise.all(
          workoutIds.map((workoutId) =>
            db.workoutExercises
              .where('workoutId')
              .equals(workoutId)
              .toArray(),
          ),
        ),
        Promise.all(
          workoutIds.map((workoutId) =>
            db.workoutSets
              .where('workoutId')
              .equals(workoutId)
              .toArray(),
          ),
        ),
      ]);

      return {
        rows: rowsByWorkout.flat(),
        sets: setsByWorkout.flat(),
      };
    },
  );
}

function projectSet(set: WorkoutSet): HistoricalSet {
  return {
    setType: set.setType,
    side: set.side,
    ...(set.weight === undefined ? {} : { weight: set.weight }),
    ...(set.reps === undefined ? {} : { reps: set.reps }),
    ...(set.durationSeconds === undefined
      ? {}
      : { durationSeconds: set.durationSeconds }),
    ...(set.distanceMeters === undefined
      ? {}
      : { distanceMeters: set.distanceMeters }),
    ...(set.rpe === undefined ? {} : { rpe: set.rpe }),
  };
}

function projectExercise(
  row: WorkoutExercise,
  exercise: Exercise | undefined,
  sets: readonly WorkoutSet[],
  defaultRepSeconds: number,
): HistoricalExercise {
  return {
    exerciseId: row.exerciseId,
    ...resolveExerciseIdentity(row, exercise),
    repSeconds: resolveRepSeconds(row.repSeconds, defaultRepSeconds),
    ...(row.notes === undefined ? {} : { notes: row.notes }),
    sets: [...sets].sort(byOrder).map(projectSet),
  };
}

export async function listHistoricalWorkouts(
  scope: HistoricalScope,
): Promise<HistoricalWorkout[]> {
  const workouts = await selectWorkouts(scope);
  if (workouts.length === 0) return [];

  const workoutIds = workouts.map((workout) => workout.id);
  const [bodyWeights, defaultRepSeconds] = await Promise.all([
    resolveBodyWeightsAt(workouts.map(({ startedAt }) => startedAt)),
    getDefaultRepSeconds(),
  ]);
  const { rows: allRows, sets: allSets } =
    await loadWorkoutGraph(workoutIds);

  const rows = alive(allRows).filter(
    (row) =>
      scope.kind !== 'exercise' ||
      row.exerciseId === scope.exerciseId,
  );
  const rowIds = new Set(rows.map((row) => row.id));

  const setsPerRow = new Map<string, WorkoutSet[]>();
  for (const set of allSets) {
    if (
      set.deletedAt !== 0 ||
      set.isCompleted !== 1 ||
      !rowIds.has(set.workoutExerciseId)
    ) {
      continue;
    }
    const list = setsPerRow.get(set.workoutExerciseId);
    if (list === undefined) {
      setsPerRow.set(set.workoutExerciseId, [set]);
    } else {
      list.push(set);
    }
  }

  const rowsPerWorkout = new Map<string, WorkoutExercise[]>();
  for (const row of rows) {
    const list = rowsPerWorkout.get(row.workoutId);
    if (list === undefined) {
      rowsPerWorkout.set(row.workoutId, [row]);
    } else {
      list.push(row);
    }
  }

  const found = await db.exercises.bulkGet([
    ...new Set(rows.map((row) => row.exerciseId)),
  ]);
  const library = new Map<string, Exercise>();
  for (const exercise of found) {
    if (exercise !== undefined) library.set(exercise.id, exercise);
  }

  return workouts
    .map((workout): HistoricalWorkout => ({
      workoutId: workout.id,
      name: workout.name,
      ...(workout.notes === undefined
        ? {}
        : { notes: workout.notes }),
      startedAt: workout.startedAt,
      ...(workout.startedTimezoneOffsetMinutes === undefined
        ? {}
        : {
            timezoneOffsetMinutes:
              workout.startedTimezoneOffsetMinutes,
          }),
      durationSeconds: workout.durationSeconds,
      ...(bodyWeights.has(workout.startedAt)
        ? { bodyWeightKg: bodyWeights.get(workout.startedAt)! }
        : {}),
      exercises: (rowsPerWorkout.get(workout.id) ?? [])
        .sort(byOrder)
        .map((row) =>
          projectExercise(
            row,
            library.get(row.exerciseId),
            setsPerRow.get(row.id) ?? [],
            defaultRepSeconds,
          ),
        ),
    }))
    .filter(
      (workout) =>
        scope.kind !== 'exercise' ||
        workout.exercises.length > 0,
    );
}
