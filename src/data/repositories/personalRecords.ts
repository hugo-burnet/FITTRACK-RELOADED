import { db } from '@/data/db';
import type {
  Exercise,
  PersonalRecord,
  PersonalRecordType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { isWorkingSet } from '@/lib/records';
import { getOneRepMaxFormula } from './settings';
import {
  reconcileAllRecords,
  reconcileRecordsForExercises,
  type RecordRebuildResult,
} from './recordReconciliation';

export const PERSONAL_RECORDS_PROJECTION_VERSION = 1;
const PROJECTION_VERSION_KEY = 'personalRecordsProjectionVersion';

export interface RecordTimelineFilters {
  exerciseId?: string;
  type?: PersonalRecordType;
}

export interface RecordTimelineEntry {
  record: PersonalRecord;
  exerciseName: string;
  workoutStatus: 'active' | 'completed';
  previousValue?: number;
  triggerWorkoutSetId?: string;
}

export type { RecordRebuildResult } from './recordReconciliation';

function compareRecordTimeline(
  left: PersonalRecord,
  right: PersonalRecord,
  triggerByRecordId: ReadonlyMap<string, string | undefined>,
  setById: ReadonlyMap<string, WorkoutSet>,
  rowById: ReadonlyMap<string, WorkoutExercise>,
): number {
  const leftSet = setById.get(triggerByRecordId.get(left.id) ?? '');
  const rightSet = setById.get(triggerByRecordId.get(right.id) ?? '');
  const leftRow = leftSet === undefined ? undefined : rowById.get(leftSet.workoutExerciseId);
  const rightRow = rightSet === undefined ? undefined : rowById.get(rightSet.workoutExerciseId);

  return (
    left.achievedAt - right.achievedAt ||
    (leftRow?.order ?? 0) - (rightRow?.order ?? 0) ||
    (leftSet?.order ?? 0) - (rightSet?.order ?? 0) ||
    (left.workoutSetId ?? left.workoutId).localeCompare(
      right.workoutSetId ?? right.workoutId,
    ) ||
    left.id.localeCompare(right.id)
  );
}

function exerciseNameFor(
  record: PersonalRecord,
  triggerWorkoutSetId: string | undefined,
  rows: readonly WorkoutExercise[],
  exercises: ReadonlyMap<string, Exercise>,
  setById: ReadonlyMap<string, WorkoutSet>,
  rowById: ReadonlyMap<string, WorkoutExercise>,
): string {
  const triggerSet = triggerWorkoutSetId === undefined ? undefined : setById.get(triggerWorkoutSetId);
  const triggerRow = triggerSet === undefined ? undefined : rowById.get(triggerSet.workoutExerciseId);
  const workoutRow =
    triggerRow?.deletedAt === 0 &&
    triggerRow.workoutId === record.workoutId &&
    triggerRow.exerciseId === record.exerciseId
      ? triggerRow
      : rows.find(
    (row) =>
      row.deletedAt === 0 &&
      row.workoutId === record.workoutId &&
      row.exerciseId === record.exerciseId,
        );
  return workoutRow?.exerciseName ?? exercises.get(record.exerciseId)?.name ?? '';
}

function lastContributingSetId(
  record: PersonalRecord,
  sets: readonly WorkoutSet[],
  rowById: ReadonlyMap<string, WorkoutExercise>,
): string | undefined {
  if (record.workoutSetId !== undefined) return record.workoutSetId;

  return sets
    .filter(
      (set) =>
        set.deletedAt === 0 &&
        set.isCompleted === 1 &&
        isWorkingSet(set) &&
        set.workoutId === record.workoutId &&
        set.exerciseId === record.exerciseId &&
        rowById.get(set.workoutExerciseId)?.deletedAt === 0 &&
        rowById.get(set.workoutExerciseId)?.workoutId === set.workoutId &&
        rowById.get(set.workoutExerciseId)?.exerciseId === set.exerciseId,
    )
    .sort((left, right) => {
      const leftRow = rowById.get(left.workoutExerciseId);
      const rightRow = rowById.get(right.workoutExerciseId);
      return (
        left.performedAt - right.performedAt ||
        (leftRow?.order ?? 0) - (rightRow?.order ?? 0) ||
        left.order - right.order ||
        left.id.localeCompare(right.id)
      );
    })
    .at(-1)?.id;
}

export async function listRecordTimeline(
  filters: RecordTimelineFilters = {},
): Promise<RecordTimelineEntry[]> {
  const [records, workouts, rows, exercises, sets] = await db.transaction(
    'r',
    db.personalRecords,
    db.workouts,
    db.workoutExercises,
    db.exercises,
    db.workoutSets,
    async () =>
      Promise.all([
        db.personalRecords.toArray(),
        db.workouts.toArray(),
        db.workoutExercises.toArray(),
        db.exercises.toArray(),
        db.workoutSets.toArray(),
      ]),
  );
  const workoutById = new Map(workouts.map((workout) => [workout.id, workout]));
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const rowById = new Map(rows.map((workoutRow) => [workoutRow.id, workoutRow]));
  const setById = new Map(sets.map((workoutSet) => [workoutSet.id, workoutSet]));
  const included = records.filter((record) => {
    const workout = workoutById.get(record.workoutId);
    return (
      record.deletedAt === 0 &&
      (filters.exerciseId === undefined || record.exerciseId === filters.exerciseId) &&
      (filters.type === undefined || record.type === filters.type) &&
      workout !== undefined &&
      workout.deletedAt === 0 &&
      (workout.status === 'active' || workout.status === 'completed')
    );
  });
  const triggerByRecordId = new Map(
    included.map((record) => [
      record.id,
      lastContributingSetId(record, sets, rowById),
    ]),
  );
  const compareTimeline = (left: PersonalRecord, right: PersonalRecord): number =>
    compareRecordTimeline(left, right, triggerByRecordId, setById, rowById);
  const previousById = new Map<string, number>();
  const previousByCategory = new Map<string, number>();
  for (const record of [...included].sort(compareTimeline)) {
    const category = `${record.exerciseId}\u0000${record.type}`;
    const previous = previousByCategory.get(category);
    if (previous !== undefined) previousById.set(record.id, previous);
    previousByCategory.set(category, record.value);
  }

  return [...included].sort((left, right) => compareTimeline(right, left)).map((record) => {
    const workout = workoutById.get(record.workoutId) as Workout & {
      status: 'active' | 'completed';
    };
    const previousValue = previousById.get(record.id);
    const triggerWorkoutSetId = triggerByRecordId.get(record.id);
    return {
      record,
      exerciseName: exerciseNameFor(
        record,
        triggerWorkoutSetId,
        rows,
        exerciseById,
        setById,
        rowById,
      ),
      workoutStatus: workout.status,
      ...(previousValue === undefined ? {} : { previousValue }),
      ...(triggerWorkoutSetId === undefined ? {} : { triggerWorkoutSetId }),
    };
  });
}

export async function listCurrentRecordsForExercise(
  exerciseId: string,
): Promise<RecordTimelineEntry[]> {
  const timeline = await listRecordTimeline({ exerciseId });
  const seen = new Set<PersonalRecordType>();
  return timeline.filter(({ record }) => {
    if (seen.has(record.type)) return false;
    seen.add(record.type);
    return true;
  });
}

export function listRecordsForWorkout(workoutId: string): Promise<RecordTimelineEntry[]> {
  return listRecordTimeline().then((timeline) =>
    timeline.filter(({ record }) => record.workoutId === workoutId),
  );
}

function writeProjectionVersion(): Promise<string> {
  return db.settings.put({
    key: PROJECTION_VERSION_KEY,
    value: PERSONAL_RECORDS_PROJECTION_VERSION,
    updatedAt: Date.now(),
  });
}

export function rebuildRecordsForExercises(
  exerciseIds: readonly string[],
): Promise<RecordRebuildResult> {
  return db.transaction(
    'rw',
    [
      db.settings,
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.bodyMeasurements,
      db.personalRecords,
    ],
    async () => reconcileRecordsForExercises(exerciseIds, await getOneRepMaxFormula()),
  );
}

export function rebuildAllRecords(): Promise<RecordRebuildResult> {
  return db.transaction(
    'rw',
    [
      db.settings,
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.bodyMeasurements,
      db.personalRecords,
    ],
    async () => {
      const result = await reconcileAllRecords(await getOneRepMaxFormula());
      await writeProjectionVersion();
      return result;
    },
  );
}

export async function isRecordProjectionCurrent(): Promise<boolean> {
  return (await db.settings.get(PROJECTION_VERSION_KEY))?.value === PERSONAL_RECORDS_PROJECTION_VERSION;
}

export function ensureRecordProjection(): Promise<'ready' | 'rebuilt'> {
  return db.transaction(
    'rw',
    [
      db.settings,
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.bodyMeasurements,
      db.personalRecords,
    ],
    async () => {
      if (await isRecordProjectionCurrent()) return 'ready';
      await reconcileAllRecords(await getOneRepMaxFormula());
      await writeProjectionVersion();
      return 'rebuilt';
    },
  );
}
