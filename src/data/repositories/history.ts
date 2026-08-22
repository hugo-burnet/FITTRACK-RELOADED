
import { db } from '@/data/db';
import type {
  Exercise,
  SetType,
  Side,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { newEntity, touch } from './base';
import { exerciseSnapshotOfRow } from '@/lib/exerciseSnapshot';
import { loadExerciseSnapshots } from './exerciseSnapshot';
import { getWorkoutDetail, type WorkoutDetail } from './workouts';
import { reconcileRecordsForExercises } from './recordReconciliation';
import { getOneRepMaxFormula } from './settings';

const RECORD_PROJECTION_TABLES = [
  db.settings,
  db.exercises,
  db.workouts,
  db.workoutExercises,
  db.workoutSets,
  db.bodyMeasurements,
  db.personalRecords,
] as const;

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

export interface ArchivedSetDraft {
  id?: string;
  setType: SetType;
  side: Side;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
}

export interface ArchivedExerciseDraft {
  id?: string;
  exerciseId: string;
  supersetGroup: number;
  restSeconds: number;
  notes?: string;
  sets: ArchivedSetDraft[];
}

export interface ArchivedWorkoutDraft {
  workoutId: string;
  name: string;
  notes?: string;
  startedAt: number;
  durationSeconds: number;
  exercises: ArchivedExerciseDraft[];
}

const byMostRecent = (left: Workout, right: Workout): number =>
  right.startedAt - left.startedAt || right.id.localeCompare(left.id);

/**
 * Les séances terminées, les plus récentes d'abord.
 *
 * Exportée pour l'accueil, qui a besoin des lignes elles-mêmes (leur `routineId`)
 * et pas seulement de leurs dates : sans ça il lui faudrait un second parcours
 * de la table pour lire ce que celui-ci a déjà en main.
 */
export async function listCompletedWorkouts(filters: HistoryFilters = {}): Promise<Workout[]> {
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

/**
 * How many sessions are actually in the history.
 *
 * A count and not a list: the settings screen only needs to know whether there
 * is anything to save, and reading every completed session into memory to
 * measure its length is the kind of thing that stops being free at four
 * thousand sessions. It lives here rather than in the screen because a
 * component never reaches for `db` — the one rule the data layer has.
 */
export async function countCompletedWorkouts(): Promise<number> {
  return db.workouts
    .where('status')
    .equals('completed')
    .filter((workout) => workout.deletedAt === 0)
    .count();
}

export async function buildWorkoutSummaries(
  workouts: readonly Workout[],
): Promise<HistoryWorkoutSummary[]> {
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
  return (await listCompletedWorkouts(filters)).map((workout) => workout.startedAt);
}

export async function listHistoryPage(
  filters: HistoryFilters,
  offset: number,
  limit = 20,
): Promise<HistoryPage> {
  const completed = await listCompletedWorkouts(filters);
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.max(1, Math.trunc(limit));
  const window = completed.slice(safeOffset, safeOffset + safeLimit + 1);

  return {
    items: await buildWorkoutSummaries(window.slice(0, safeLimit)),
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

  const workouts = (await listCompletedWorkouts(filters)).filter(
    (workout) => workout.startedAt >= start.getTime() && workout.startedAt < end.getTime(),
  );
  return buildWorkoutSummaries(workouts);
}

export async function listHistoryExerciseOptions(): Promise<
  Array<Pick<Exercise, 'id' | 'name'>>
> {
  const completedIds = new Set(
    (await listCompletedWorkouts({})).map((workout) => workout.id),
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

export async function getArchivedWorkoutDetail(
  workoutId: string,
): Promise<WorkoutDetail | null> {
  // Keep archive totals on the same resolved detail contract as the live
  // workout, including the body weight effective at the workout timestamp.
  const detail = await getWorkoutDetail(workoutId);
  return detail?.workout.status === 'completed' ? detail : null;
}

function assertArchivedDraft(draft: ArchivedWorkoutDraft): void {
  if (draft.name.trim() === '') throw new RangeError('Workout name is required');
  if (!Number.isFinite(draft.startedAt) || draft.startedAt < 0) {
    throw new RangeError('Workout start must be a valid timestamp');
  }
  if (!Number.isInteger(draft.durationSeconds) || draft.durationSeconds < 0) {
    throw new RangeError('Workout duration must be a non-negative integer');
  }

  const exerciseIds = draft.exercises.flatMap((row) =>
    row.id === undefined ? [] : [row.id],
  );
  if (new Set(exerciseIds).size !== exerciseIds.length) {
    throw new RangeError('Workout exercise ids must be unique');
  }

  const setIds = draft.exercises.flatMap((row) =>
    row.sets.flatMap((set) => (set.id === undefined ? [] : [set.id])),
  );
  if (new Set(setIds).size !== setIds.length) {
    throw new RangeError('Workout set ids must be unique');
  }
}

export async function saveArchivedWorkout(draft: ArchivedWorkoutDraft): Promise<void> {
  assertArchivedDraft(draft);

  // Read outside the transaction, which spans the record projection tables.
  // Only rows whose exercise is new or corrected consume this — the rest keep
  // the snapshot they were created with.
  const snapshots = await loadExerciseSnapshots(
    draft.exercises.map((row) => row.exerciseId),
  );

  await db.transaction('rw', RECORD_PROJECTION_TABLES, async () => {
    const workout = await db.workouts.get(draft.workoutId);
    if (
      workout === undefined ||
      workout.deletedAt !== 0 ||
      workout.status !== 'completed'
    ) {
      throw new Error('Archived workout not found');
    }

    const rows = (
      await db.workoutExercises.where('workoutId').equals(draft.workoutId).toArray()
    ).filter((row) => row.deletedAt === 0);
    const rowIds = new Set(rows.map((row) => row.id));
    if (draft.exercises.some((row) => row.id !== undefined && !rowIds.has(row.id))) {
      throw new Error('Workout exercise does not belong to archived workout');
    }

    const sets = (
      await db.workoutSets.where('workoutId').equals(draft.workoutId).toArray()
    ).filter((set) => set.deletedAt === 0);
    const affectedExerciseIds = new Set([
      ...rows.map((row) => row.exerciseId),
      ...sets.map((set) => set.exerciseId),
    ]);
    const setIds = new Set(sets.map((set) => set.id));
    if (
      draft.exercises.some((row) =>
        row.sets.some((set) => set.id !== undefined && !setIds.has(set.id)),
      )
    ) {
      throw new Error('Workout set does not belong to archived workout');
    }

    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const setsById = new Map(sets.map((set) => [set.id, set]));
    const keptRowIds = new Set<string>();
    const keptSetIds = new Set<string>();
    let setSequence = 0;

    const nextRows: WorkoutExercise[] = [];
    const nextSets: WorkoutSet[] = [];

    for (const [order, rowDraft] of draft.exercises.entries()) {
      const existingRow = rowDraft.id === undefined ? undefined : rowsById.get(rowDraft.id);
      // The snapshot follows `exerciseId`, and only `exerciseId`. A new row, or
      // a row whose exercise the user corrects, is asserting what was actually
      // performed and gets today's metadata. A row left alone keeps what it was
      // created with, even if the library has been edited since — that is the
      // whole reason the fields exist.
      const snapshot =
        existingRow === undefined || existingRow.exerciseId !== rowDraft.exerciseId
          ? (snapshots.get(rowDraft.exerciseId) ?? {})
          : exerciseSnapshotOfRow(existingRow);
      const rowData = {
        workoutId: workout.id,
        exerciseId: rowDraft.exerciseId,
        order,
        supersetGroup: rowDraft.supersetGroup,
        restSeconds: rowDraft.restSeconds,
        ...snapshot,
        ...(rowDraft.notes === undefined ? {} : { notes: rowDraft.notes }),
      };
      const row =
        existingRow === undefined
          ? newEntity<WorkoutExercise>(rowData)
          : touch<WorkoutExercise>(
            {
              id: existingRow.id,
              createdAt: existingRow.createdAt,
              updatedAt: existingRow.updatedAt,
              deletedAt: 0,
              ...rowData,
            },
            {},
          );
      nextRows.push(row);
      keptRowIds.add(row.id);

      for (const [orderInExercise, setDraft] of rowDraft.sets.entries()) {
        const sequence = setSequence;
        setSequence += 1;
        const existingSet = setDraft.id === undefined ? undefined : setsById.get(setDraft.id);
        const setData = {
          workoutExerciseId: row.id,
          exerciseId: row.exerciseId,
          workoutId: workout.id,
          order: orderInExercise,
          setType: setDraft.setType,
          side: setDraft.side,
          ...(setDraft.weight === undefined ? {} : { weight: setDraft.weight }),
          ...(setDraft.reps === undefined ? {} : { reps: setDraft.reps }),
          ...(setDraft.durationSeconds === undefined
            ? {}
            : { durationSeconds: setDraft.durationSeconds }),
          ...(setDraft.distanceMeters === undefined
            ? {}
            : { distanceMeters: setDraft.distanceMeters }),
          ...(setDraft.rpe === undefined ? {} : { rpe: setDraft.rpe }),
          ...(existingSet?.targetReps === undefined
            ? {}
            : { targetReps: existingSet.targetReps }),
          ...(existingSet?.targetRepsMax === undefined
            ? {}
            : { targetRepsMax: existingSet.targetRepsMax }),
          ...(existingSet?.targetWeight === undefined
            ? {}
            : { targetWeight: existingSet.targetWeight }),
          ...(existingSet?.targetDurationSeconds === undefined
            ? {}
            : { targetDurationSeconds: existingSet.targetDurationSeconds }),
          ...(existingSet?.targetDistanceMeters === undefined
            ? {}
            : { targetDistanceMeters: existingSet.targetDistanceMeters }),
          isCompleted: 1 as const,
          performedAt:
            existingSet === undefined
              ? Math.max(1, draft.startedAt + sequence + 1)
              : Math.max(
                1,
                existingSet.performedAt + draft.startedAt - workout.startedAt,
              ),
        };
        const set =
          existingSet === undefined
            ? newEntity<WorkoutSet>(setData)
            : touch<WorkoutSet>(
              {
                id: existingSet.id,
                createdAt: existingSet.createdAt,
                updatedAt: existingSet.updatedAt,
                deletedAt: 0,
                ...setData,
              },
              {},
            );
        nextSets.push(set);
        keptSetIds.add(set.id);
      }
    }

    const deletedAt = Date.now();
    const deletedRows = rows
      .filter((row) => !keptRowIds.has(row.id))
      .map((row) => touch(row, { deletedAt }));
    const deletedSets = sets
      .filter((set) => !keptSetIds.has(set.id))
      .map((set) => touch(set, { deletedAt }));
    const updatedWorkout = touch(workout, {
      name: draft.name,
      status: 'completed',
      startedAt: draft.startedAt,
      endedAt: draft.startedAt + draft.durationSeconds * 1000,
      durationSeconds: draft.durationSeconds,
      notes: draft.notes,
    });

    await db.workouts.put(updatedWorkout);
    await db.workoutExercises.bulkPut([...nextRows, ...deletedRows]);
    await db.workoutSets.bulkPut([...nextSets, ...deletedSets]);
    for (const row of nextRows) affectedExerciseIds.add(row.exerciseId);
    for (const set of nextSets) affectedExerciseIds.add(set.exerciseId);
    await reconcileRecordsForExercises(
      [...affectedExerciseIds],
      await getOneRepMaxFormula(),
    );
  });
}
export async function deleteArchivedWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', RECORD_PROJECTION_TABLES, async () => {
    const workout = await db.workouts.get(workoutId);
    if (
      workout === undefined ||
      workout.deletedAt !== 0 ||
      workout.status !== 'completed'
    ) {
      throw new Error('Archived workout not found');
    }

    const [rows, sets] = await Promise.all([
      db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
      db.workoutSets.where('workoutId').equals(workoutId).toArray(),
    ]);
    const affectedExerciseIds = new Set([
      ...rows.map((row) => row.exerciseId),
      ...sets.map((set) => set.exerciseId),
    ]);
    const now = Date.now();
    const deleted = { deletedAt: now, updatedAt: now };

    await db.workouts.put({ ...workout, ...deleted });
    await db.workoutExercises.bulkPut(rows.map((row) => ({ ...row, ...deleted })));
    await db.workoutSets.bulkPut(sets.map((set) => ({ ...set, ...deleted })));
    await reconcileRecordsForExercises(
      [...affectedExerciseIds],
      await getOneRepMaxFormula(),
    );
  });
}
