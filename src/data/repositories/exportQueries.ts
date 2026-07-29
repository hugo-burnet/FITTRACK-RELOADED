import { db } from '@/data/db';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import type { ExportScope, ExportSource } from '@/lib/export/types';
import { alive } from './base';

/**
 * The bounded reads the exports and, later, the charts are built on.
 *
 * **Why not `getWorkoutDetail`.** It answers a different question, and answering
 * this one with it would be wrong three times over:
 *
 * - it runs one `getLastPerformance` per distinct exercise, for the live
 *   screen's "previous" column. A year of history would pay that on every
 *   session, for a figure no export contains;
 * - it drops a soft-deleted exercise from the library map, so a session using a
 *   deleted movement would lose its fallback name. An export keeps it: a deleted
 *   exercise is still the exercise that was performed;
 * - it reads one session at a time.
 *
 * Rules, in one place so all four scopes obey them: completed and live sessions
 * only, live exercise rows and sets only, **validated sets only** — an unticked
 * set is not a performance — and `from` inclusive, `to` exclusive, the bounds
 * `listHistoryDay` already uses.
 */

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

const byOldestFirst = (left: Workout, right: Workout): number =>
  left.startedAt - right.startedAt || left.id.localeCompare(right.id);

const isArchived = (workout: Workout | undefined): workout is Workout =>
  workout !== undefined && workout.deletedAt === 0 && workout.status === 'completed';

const withinBounds = (at: number, from?: number, to?: number): boolean =>
  (from === undefined || at >= from) && (to === undefined || at < to);

async function selectWorkouts(scope: ExportScope): Promise<Workout[]> {
  if (scope.kind === 'workout') {
    const workout = await db.workouts.get(scope.workoutId);
    return isArchived(workout) ? [workout] : [];
  }

  if (scope.kind === 'period') {
    // The `startedAt` index does the bounding, rather than loading the whole
    // table and filtering in memory the way the history screen does.
    const found = await db.workouts.where('startedAt').between(scope.from, scope.to, true, false).toArray();
    return found.filter(isArchived).sort(byOldestFirst);
  }

  if (scope.kind === 'exercise') {
    const rows = alive(
      await db.workoutExercises.where('exerciseId').equals(scope.exerciseId).toArray(),
    );
    const found = await db.workouts.bulkGet([...new Set(rows.map((row) => row.workoutId))]);

    return found
      .filter(isArchived)
      .filter((workout) => withinBounds(workout.startedAt, scope.from, scope.to))
      .sort(byOldestFirst);
  }

  const found = await db.workouts.where('status').equals('completed').toArray();
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
            db.workoutSets.where('workoutId').equals(workoutId).toArray(),
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

export async function listExportSources(scope: ExportScope): Promise<ExportSource[]> {
  const workouts = await selectWorkouts(scope);
  if (workouts.length === 0) return [];

  const workoutIds = workouts.map((workout) => workout.id);
  const { rows: allRows, sets: allSets } = await loadWorkoutGraph(workoutIds);

  const rows = alive(allRows).filter(
    (row) => scope.kind !== 'exercise' || row.exerciseId === scope.exerciseId,
  );
  const rowIds = new Set(rows.map((row) => row.id));

  const setsPerRow = new Map<string, WorkoutSet[]>();
  for (const set of allSets) {
    if (set.deletedAt !== 0 || set.isCompleted !== 1 || !rowIds.has(set.workoutExerciseId)) continue;
    const list = setsPerRow.get(set.workoutExerciseId);
    if (list === undefined) setsPerRow.set(set.workoutExerciseId, [set]);
    else list.push(set);
  }

  const rowsPerWorkout = new Map<string, WorkoutExercise[]>();
  for (const row of rows) {
    const list = rowsPerWorkout.get(row.workoutId);
    if (list === undefined) rowsPerWorkout.set(row.workoutId, [row]);
    else list.push(row);
  }

  // Read through `bulkGet`, not `alive()`: the library is only ever a fallback
  // for a row with no snapshot, and refusing a soft-deleted row would throw away
  // the one name available. Same reasoning as `loadExerciseSnapshots`.
  const found = await db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]);
  const library = new Map<string, Exercise>();
  for (const exercise of found) if (exercise !== undefined) library.set(exercise.id, exercise);

  return workouts
    .map((workout) => ({
      workout,
      exercises: (rowsPerWorkout.get(workout.id) ?? []).sort(byOrder).map((row) => ({
        row,
        exercise: library.get(row.exerciseId),
        sets: (setsPerRow.get(row.id) ?? []).sort(byOrder),
      })),
    }))
    // A session with no exercise is still a session, except under an exercise
    // scope, where it is a session that simply does not concern the question.
    .filter((source) => scope.kind !== 'exercise' || source.exercises.length > 0);
}
